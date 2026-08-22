/**
 * POST /api/steps/send-now
 *
 * Dispatches a sequence step immediately through Gmail, bypassing scheduled delays.
 * Updates the database atomically and advances the sequence.
 */
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import prisma from "@/lib/prisma";
import { sendStep } from "@/lib/gmail/sender";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { stepId, queueId, recipientEmail, stepNumber } = body;

    // 3-Layer Smart Step Resolution:
    let targetStep = null;
    if (stepId) {
      targetStep = await prisma.sequenceStep.findFirst({
        where: {
          id: stepId,
          sequence: { user_id: userId },
        },
        include: { sequence: { include: { prospect: true } } },
      });
    }

    if (!targetStep && (recipientEmail || body.email)) {
      const emailToMatch = (recipientEmail || body.email).toLowerCase().trim();
      const stepNum = Number(stepNumber) || 1;
      targetStep = await prisma.sequenceStep.findFirst({
        where: {
          step_number: stepNum,
          sequence: {
            status: "ACTIVE",
            user_id: userId,
            prospect: { email: emailToMatch },
          },
        },
        include: { sequence: { include: { prospect: true } } },
        orderBy: { sequence: { created_at: "desc" } },
      });
    }

    if (!targetStep && queueId) {
      const rawSeqId = queueId.includes("_s") ? queueId.split("_s")[0].split("_").pop() : queueId;
      targetStep = await prisma.sequenceStep.findFirst({
        where: {
          OR: [
            { id: queueId },
            { sequence_id: rawSeqId }
          ],
          sequence: { user_id: userId },
        },
        include: { sequence: { include: { prospect: true } } },
      });
    }

    if (!targetStep) {
      return NextResponse.json({ error: "Step not found" }, { status: 404 });
    }

    if (targetStep.status === "SENT" || targetStep.gmail_message_id) {
      return NextResponse.json({
        ok: true,
        outcome: "SENT",
        message: "Email was already delivered to Gmail",
        stepId: targetStep.id,
        gmailMessageId: targetStep.gmail_message_id,
      });
    }

    // Set step to PROCESSING and update scheduled/eligible timestamps to NOW
    await prisma.sequenceStep.update({
      where: { id: targetStep.id },
      data: {
        status: "PROCESSING",
        claimed_at: new Date(),
        scheduled_at_utc: new Date(),
        eligible_after_utc: new Date(),
        delay_reason: null,
        retry_at: null,
      },
    });

    // Execute send directly via Gmail pipeline
    const sendResult = await sendStep(targetStep.id);

    if (sendResult.outcome === "SENT") {
      return NextResponse.json({
        ok: true,
        outcome: "SENT",
        stepId: targetStep.id,
        gmailMessageId: sendResult.gmailMessageId,
        gmailThreadId: sendResult.gmailThreadId,
      });
    } else if (sendResult.outcome === "ABORTED") {
      return NextResponse.json({
        ok: true,
        outcome: "SENT",
        stepId: targetStep.id,
        message: sendResult.detail || "Step already processed",
      });
    } else {
      return NextResponse.json({
        ok: false,
        outcome: sendResult.outcome,
        stepId: targetStep.id,
        detail: sendResult.detail || "Send failed",
      }, { status: 400 });
    }
  } catch (error: any) {
    console.error("[POST /api/steps/send-now] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to send step now" }, { status: 500 });
  }
}
