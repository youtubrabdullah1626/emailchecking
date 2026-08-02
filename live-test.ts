import { PrismaClient } from '@prisma/client';
import { runScheduler } from './src/lib/scheduler/run';
import { sendBatch } from './src/lib/gmail/sender';
import { scanForReplies } from './src/lib/reply/scanner';
import { google } from 'googleapis';
import { createOAuth2Client } from './src/lib/gmail/oauth';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runLiveTests() {
  console.log("==========================================");
  console.log("STARTING LIVE REPLY DETECTION TESTS (5 RUNS)");
  console.log("==========================================");

  let successCount = 0;
  const SENDER_EMAIL = process.env.GMAIL_SENDER_EMAIL || "youtubrabdullah1626@gmail.com";
  
  // Set the override flag so the classifier doesn't skip our own sent replies during the test
  process.env.LIVE_TEST_OVERRIDE = "true";

  // Cleanup past test data globally before start
  await prisma.sequence.deleteMany({ where: { prospect: { email: SENDER_EMAIL } } });
  await prisma.prospect.deleteMany({ where: { email: SENDER_EMAIL } });

  for (let i = 1; i <= 5; i++) {
    console.log(`\n--- RUN ${i}/5 ---`);
    const prospectId = `test_prospect_live_${Date.now()}_${i}`;
    const sequenceId = `test_seq_live_${Date.now()}_${i}`;
    const stepId = `test_step_live_${Date.now()}_${i}`;

    try {
      // 1. Create Prospect and Sequence
      console.log(`[Run ${i}] Creating prospect and sequence...`);
      await prisma.prospect.upsert({
        where: { email: SENDER_EMAIL },
        update: { status: "ACTIVE" },
        create: {
          id: prospectId,
          email: SENDER_EMAIL, // Using sender email so it delivers to us
          name: `Live Test ${i}`,
          company: "Test Corp",
          status: "ACTIVE",
          timezone: "UTC",
        }
      });
      
      const realProspect = await prisma.prospect.findUnique({ where: { email: SENDER_EMAIL }});

      // Clear any sequences for this prospect to avoid unique constraint error
      await prisma.sequence.deleteMany({ where: { prospect_id: realProspect!.id } });

      await prisma.sequence.create({
        data: {
          id: sequenceId,
          prospect_id: realProspect!.id,
          status: "ACTIVE",
          steps: {
            create: {
              id: stepId,
              step_number: 1,
              subject: `Live Test Thread ${i}`,
              body: `This is the initial outbound message for run ${i}.`,
              scheduled_at_utc: new Date(),
              scheduled_time_local: "12:00",
              timezone: "UTC",
              status: "PENDING",
            }
          }
        }
      });

      // 2. Trigger Scheduler & Sender
      console.log(`[Run ${i}] Running scheduler and sender...`);
      const sched = await runScheduler({ dryRun: false });
      if (sched.claimedStepIds.length > 0) {
        await sendBatch(sched.claimedStepIds);
      }

      // Wait for Gmail to process the send
      await delay(4000);

      // Get the Thread ID
      const step = await prisma.sequenceStep.findUnique({ where: { id: stepId }});
      if (!step || !step.gmail_thread_id) {
        throw new Error(`[Run ${i}] Failed to send initial email. No thread ID.`);
      }
      
      const threadId = step.gmail_thread_id;
      const originalMessageId = step.gmail_message_id;
      console.log(`[Run ${i}] Initial email sent. Thread ID: ${threadId}`);

      // 3. Send a "Reply" using the Gmail API
      console.log(`[Run ${i}] Sending simulated reply...`);
      const auth = createOAuth2Client();
      const gmail = google.gmail({ version: "v1", auth });
      
      // We must format it properly to be threaded
      const rawMessage = [
        `From: ${SENDER_EMAIL}`,
        `To: ${SENDER_EMAIL}`,
        `Subject: Re: Live Test Thread ${i}`,
        `In-Reply-To: ${originalMessageId}`,
        `References: ${originalMessageId}`,
        'Content-Type: text/plain; charset="UTF-8"',
        '',
        `This is the simulated reply for run ${i}!`
      ].join('\n');
      
      const encodedMessage = Buffer.from(rawMessage).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      
      const replyRes = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedMessage,
          threadId: threadId
        }
      });
      
      console.log(`[Run ${i}] Simulated reply sent. Message ID: ${replyRes.data.id}`);

      // Wait for Gmail to index the reply
      await delay(5000);

      // 4. Run the Scanner
      console.log(`[Run ${i}] Running reply scanner...`);
      const scanRes = await scanForReplies();
      
      // 5. Verify the Database
      console.log(`[Run ${i}] Verifying database state...`);
      const updatedProspect = await prisma.prospect.findUnique({ where: { id: prospectId }});
      const updatedSequence = await prisma.sequence.findUnique({ where: { id: sequenceId }});
      const classification = await prisma.replyClassification.findFirst({ where: { gmail_thread_id: threadId, reply_type: "REAL_REPLY" }});
      
      const isSuccess = 
        updatedProspect?.status === "REPLIED" && 
        updatedSequence?.status === "STOPPED" &&
        classification !== null;

      if (isSuccess) {
        console.log(`[Run ${i}] ✅ SUCCESS`);
        console.log(`Thread ID: ${threadId}`);
        console.log(`Message ID: ${classification.gmail_message_id}`);
        console.log(`From: ${SENDER_EMAIL}`);
        console.log(`To: ${SENDER_EMAIL}`);
        console.log(`Subject: Re: Live Test Thread ${i}`);
        console.log(`Internal Date: ${classification.classified_at}`);
        console.log(`Matched Prospect: ${updatedProspect.id}`);
        console.log(`Matched Sequence: ${updatedSequence.id}`);
        console.log(`Classification: REAL_REPLY`);
        console.log(`Database Update Result: Prospect REPLIED, Sequence STOPPED`);
        successCount++;
      } else {
        console.log(`[Run ${i}] ❌ FAILED`);
        console.log(`Prospect Status: ${updatedProspect?.status}`);
        console.log(`Sequence Status: ${updatedSequence?.status}`);
        console.log(`Classification Found: ${classification !== null}`);
        console.log(`Scanner Dump: ${JSON.stringify(scanRes, null, 2)}`);
      }

    } catch (e: any) {
      console.error(`[Run ${i}] Exception occurred: ${e.message}`);
    }
  }

  console.log("==========================================");
  console.log(`Live Tests: \n${successCount}/5 Passed`);
  console.log("==========================================");
}

runLiveTests().finally(() => prisma.$disconnect());
