import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendStep } from "@/lib/gmail/sender";
import { getActiveSequence, createSequence } from "@/lib/db/sequences";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { to, toName, subject, content } = body;
    
    if (!to || !content) {
      return NextResponse.json({ error: "Missing 'to' or 'content'" }, { status: 400 });
    }

    let messageId: string | undefined;
    let threadId: string | undefined;

    // 1. Ensure Prospect and Sequence exist
    const emailLower = to.toLowerCase();
    let prospect = await prisma.prospect.findUnique({ where: { email: emailLower } });
    
    if (!prospect) {
      prospect = await prisma.prospect.create({
        data: {
          email: emailLower,
          name: toName || to.split("@")[0],
          company: "Unknown",
          timezone: "UTC",
        }
      });
    }

    // For a "Send Now" demo action, we ALWAYS create a brand new sequence.
    // This prevents the new test email from being accidentally threaded as a follow-up
    // to an older, unrelated sequence (which causes confusion in Gmail's conversation view).
    
    // Stop any currently active sequences for this prospect to prevent collisions
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
    
    const sequence = newSeqResult.data;
    const step = sequence.steps[0];
    
    // Mark sequence as ACTIVE immediately since this is an immediate send-demo action
    await prisma.sequence.update({
      where: { id: sequence.id },
      data: { status: "ACTIVE", started_at: new Date() }
    });

    // 3. Claim the step atomically (simulating what the scheduler or send-now does)
    const claimed = await prisma.sequenceStep.updateMany({
      where: { id: step.id, status: "PENDING" },
      data: { status: "PROCESSING" },
    });

    if (claimed.count > 0) {
      // 4. Send via the pure backend engine (injects tracking, sets thread ID, etc.)
      const result = await sendStep(step.id);
      if (result.outcome === "SENT") {
        messageId = result.gmailMessageId;
        threadId = result.gmailThreadId;
      } else {
        throw new Error(result.detail || "Failed to send email via backend engine");
      }
    } else {
      throw new Error("Failed to claim step for sending");
    }

    return NextResponse.json({ ok: true, messageId, threadId });
  } catch (err: any) {
    console.error("send-demo error", err);
    return NextResponse.json({ error: err.message || "Failed to send email" }, { status: 500 });
  }
}
