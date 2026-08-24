/**
 * POST /api/steps/reschedule
 *
 * Reschedules a sequence step in PostgreSQL.
 * If rescheduled to NOW or the past, executes immediate in-process dispatch via Gmail.
 * If rescheduled to the future, stores exact UTC timestamps for scheduler dispatch.
 */
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import prisma from "@/lib/prisma";
import { sendStep } from "@/lib/gmail/sender";
import { runScheduler } from "@/lib/scheduler/run";
import { toUtcFromZonedTime } from "@/lib/date-utils";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { stepId, queueId, recipientEmail, stepNumber, newDate, newTime, timezone = "UTC" } = body;

    if (!newDate) {
      return NextResponse.json({ error: "Missing newDate" }, { status: 400 });
    }

    const timeStr = newTime || "09:00";
    
    // 3-Layer Smart Step Resolution:
    // Layer 1: Try direct step ID match
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

    // Layer 2: Try finding by recipient email & step number in ACTIVE sequence
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

    // Layer 3: Try parsing sequence ID from queueId
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

    // Compute UTC datetime from local date + time in target timezone
    const scheduledUtc = toUtcFromZonedTime(newDate, timeStr, timezone);
    const now = new Date();
    let isPastOrDue = scheduledUtc.getTime() <= (now.getTime() + 60000); // within 1 minute is considered due NOW
    const isFirstStep = targetStep.step_number === 1;

    // Sequential Guard: If follow-up step is rescheduled to past/now, verify previous step is SENT first
    if (!isFirstStep) {
      const prevStep = await prisma.sequenceStep.findFirst({
        where: {
          sequence_id: targetStep.sequence_id,
          step_number: targetStep.step_number - 1,
        },
        select: { status: true }
      });
      if (!prevStep || prevStep.status !== "SENT") {
        isPastOrDue = false; // Cannot dispatch immediately if previous step not sent
      }
    }

    // For first steps or steps rescheduled to the past/now: set eligible_after_utc = scheduledUtc
    const eligibleAfter = (isFirstStep || isPastOrDue) ? scheduledUtc : targetStep.eligible_after_utc;


    const updatedStep = await prisma.sequenceStep.update({
      where: { id: targetStep.id },
      data: {
        scheduled_at_utc: scheduledUtc,
        eligible_after_utc: eligibleAfter,
        scheduled_time_local: timeStr,
        timezone: timezone,
        status: isPastOrDue ? "PROCESSING" : "PENDING",
        claimed_at: isPastOrDue ? new Date() : null,
        delay_reason: null,
        retry_at: null,
      },
    });

    // If rescheduled to NOW or the past, dispatch immediately in-process
    if (isPastOrDue) {
      try {
        const sendResult = await sendStep(updatedStep.id);
        if (sendResult.outcome === "SENT") {
          return NextResponse.json({
            ok: true,
            sentImmediately: true,
            stepId: updatedStep.id,
            outcome: "SENT",
            gmailMessageId: sendResult.gmailMessageId,
            gmailThreadId: sendResult.gmailThreadId,
            status: "SENT",
          });
        }
        // If send was ABORTED/FAILED, reset back to PENDING so it's not permanently stuck
        await prisma.sequenceStep.update({
          where: { id: updatedStep.id },
          data: {
            status: "PENDING",
            claimed_at: null,
            eligible_after_utc: scheduledUtc,
          },
        }).catch(() => {});
        // Trigger background scheduler as fallback
        runScheduler().catch(() => {});
      } catch (sendErr: any) {
        console.error("[reschedule] In-process send error:", sendErr);
        // Self-heal: reset to PENDING so it's not stuck in PROCESSING
        await prisma.sequenceStep.update({
          where: { id: updatedStep.id },
          data: { status: "PENDING", claimed_at: null },
        }).catch(() => {});
        runScheduler().catch(() => {});
      }
    }

    return NextResponse.json({
      ok: true,
      sentImmediately: false,
      stepId: updatedStep.id,
      scheduled_at_utc: updatedStep.scheduled_at_utc.toISOString(),
      eligible_after_utc: updatedStep.eligible_after_utc?.toISOString() ?? null,
      scheduled_time_local: updatedStep.scheduled_time_local,
      status: updatedStep.status,
    });
  } catch (error: any) {
    console.error("[POST /api/steps/reschedule] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to reschedule step" }, { status: 500 });
  }
}
