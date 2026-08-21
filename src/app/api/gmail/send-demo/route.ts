import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendStep } from "@/lib/gmail/sender";
import { getActiveSequence, createSequence } from "@/lib/db/sequences";
import { getSession } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { to, toName, subject, content, importSequenceId, stepNumber } = body;
    
    if (!to || !content) {
      return NextResponse.json({ error: "Missing 'to' or 'content'" }, { status: 400 });
    }

    let messageId: string | undefined;
    let threadId: string | undefined;

    // 1. Ensure Prospect and Sequence exist with strict multi-tenant session binding
    const emailLower = to.toLowerCase();
    
    const session = await getSession();
    let realUserId = session?.user?.id;

    if (!realUserId) {
      // Fallback: Check for connected EmailAccount user, or first user in system
      const connectedAccount = await prisma.emailAccount.findFirst({
        where: { connection_status: "CONNECTED", refresh_token: { not: null } },
        select: { user_id: true }
      });
      if (connectedAccount?.user_id) {
        realUserId = connectedAccount.user_id;
      } else {
        const firstUser = await prisma.users.findFirst({ select: { id: true } });
        if (!firstUser) {
          return NextResponse.json({ error: "System error: No admin user found in the database." }, { status: 500 });
        }
        realUserId = firstUser.id;
      }
    }

    let prospect = await prisma.prospect.findFirst({ where: { email: emailLower, user_id: realUserId } });
    
    if (!prospect) {
      prospect = await prisma.prospect.create({
        data: {
          email: emailLower,
          name: toName || to.split("@")[0],
          company: "Unknown",
          timezone: "UTC",
          user_id: realUserId,
        }
      });
    }

    if (prospect.campaign_id) {
      const parentCampaign = await prisma.campaign.findUnique({
        where: { id: prospect.campaign_id },
        select: { status: true }
      });
      if (parentCampaign && parentCampaign.status === "PAUSED") {
        return NextResponse.json({ error: "Campaign is currently paused. Please resume the campaign to send emails." }, { status: 400 });
      }
    }

    let sequence;
    let step;

    if (importSequenceId) {
      // If the frontend passed an importSequenceId (e.g. from Smart Import), we group steps
      // with the exact same importSequenceId into a single Sequence so they thread together correctly.
      sequence = await prisma.sequence.findUnique({ where: { id: importSequenceId } });
      
      if (!sequence) {
        // Stop any old campaigns to prevent collisions, as this is a new Smart Import campaign
        await prisma.sequence.updateMany({
          where: { prospect_id: prospect.id, status: { in: ["ACTIVE", "DRAFT"] } },
          data: { status: "STOPPED", stopped_at: new Date() }
        });

        sequence = await prisma.sequence.create({
          data: {
            id: importSequenceId, // Force the ID so subsequent steps can find it
            prospect_id: prospect.id,
            status: "ACTIVE",
            started_at: new Date(),
            user_id: realUserId,
          }
        });
      }
      
      step = await prisma.sequenceStep.upsert({
        where: {
          sequence_id_step_number: {
            sequence_id: sequence.id,
            step_number: stepNumber || 1,
          }
        },
        create: {
          sequence_id: sequence.id,
          step_number: stepNumber || 1,
          subject: subject || "Important Outreach",
          body: content,
          scheduled_at_utc: new Date(),
          scheduled_time_local: new Date().toLocaleTimeString(),
          timezone: "UTC",
          status: "PENDING",
        },
        update: {
          subject: subject || "Important Outreach",
          body: content,
          status: "PENDING", // Reset to PENDING for retry/re-execution
        }
      });
    } else {
      // Traditional manual "Send Now" without a specific sequence context
      // We ALWAYS create a brand new sequence so it doesn't thread with old, unrelated sequences.
      await prisma.sequence.updateMany({
        where: { prospect_id: prospect.id, status: { in: ["ACTIVE", "DRAFT"] } },
        data: { status: "STOPPED", stopped_at: new Date() }
      });

      const newSeqResult = await createSequence(prospect.id, [{
        step_number: 1,
        subject: subject || "Important Outreach",
        body: content,
        scheduled_at_utc: new Date(),
        scheduled_time_local: new Date().toLocaleTimeString(),
        timezone: "UTC",
        computed_date: new Date().toISOString().split('T')[0],
      }]);
      
      if (!newSeqResult.ok) {
        throw new Error(newSeqResult.message);
      }
      sequence = newSeqResult.data;
      step = sequence.steps[0];
      
      await prisma.sequence.update({
        where: { id: sequence.id },
        data: { status: "ACTIVE", started_at: new Date() }
      });
    }

    // Ensure the step is ready for execution (reset stale status and IDs if retrying/re-executing)
    await prisma.sequenceStep.update({
      where: { id: step.id },
      data: {
        status: "PROCESSING",
        gmail_message_id: null,
        gmail_thread_id: null,
        sent_at: null,
      }
    });

    // 4. Send via the pure backend engine (injects tracking, sets thread ID, etc.)
    const result = await sendStep(step.id);
    if (result.outcome === "SENT") {
      messageId = result.gmailMessageId;
      threadId = result.gmailThreadId;
    } else {
      throw new Error(result.detail || "Failed to send email via backend engine");
    }

    return NextResponse.json({ ok: true, messageId, threadId, stepId: step.id, sequenceId: sequence.id });
  } catch (err: any) {
    console.error("send-demo error", err);
    return NextResponse.json({ error: err.message || "Failed to send email" }, { status: 500 });
  }
}
