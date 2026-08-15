import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/nextauth";
import prisma from "@/lib/prisma";
import { sendStep } from "@/lib/gmail/sender";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { stepId, trackedEmailId } = body;

    let targetStepId = stepId;

    if (!targetStepId && trackedEmailId) {
      const tracked = await prisma.trackedEmail.findUnique({
        where: { id: trackedEmailId }
      });
      if (tracked?.source_id) {
        targetStepId = tracked.source_id;
      }
    }

    if (!targetStepId) {
      return NextResponse.json({ error: "Step ID is required to retry send" }, { status: 400 });
    }

    // Reset step to ready status
    await prisma.sequenceStep.update({
      where: { id: targetStepId },
      data: {
        status: "PROCESSING",
        delay_reason: null,
      }
    });

    const result = await sendStep(targetStepId);

    if (result.outcome === "SENT") {
      return NextResponse.json({
        success: true,
        message: "Email re-sent successfully",
        gmailMessageId: result.gmailMessageId,
        gmailThreadId: result.gmailThreadId
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.detail || "Retry execution failed"
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error("[POST /api/timeline/retry] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to retry step" }, { status: 500 });
  }
}
