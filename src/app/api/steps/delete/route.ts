/**
 * POST /api/steps/delete
 *
 * Cancels a sequence step in PostgreSQL so it is never dispatched by the scheduler.
 */
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import prisma from "@/lib/prisma";

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
        include: { sequence: true },
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
        include: { sequence: true },
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
        include: { sequence: true },
      });
    }

    if (!targetStep) {
      return NextResponse.json({ error: "Step not found" }, { status: 404 });
    }

    await prisma.sequenceStep.update({
      where: { id: targetStep.id },
      data: {
        status: "CANCELLED",
        delay_reason: "DELETED_BY_USER",
      },
    });

    return NextResponse.json({ ok: true, stepId: targetStep.id });
  } catch (error: any) {
    console.error("[POST /api/steps/delete] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to delete step" }, { status: 500 });
  }
}
