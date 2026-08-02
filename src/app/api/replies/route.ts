export const dynamic = "force-dynamic";
/**
 * GET /api/replies
 *
 * Operator Reply Intelligence Endpoint — Lists all reply classifications from DB.
 */

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const records = await prisma.replyClassification.findMany({
      orderBy: { classified_at: "desc" },
      take: 100,
      include: {
        prospect: {
          select: {
            id: true,
            name: true,
            company: true,
            email: true,
            status: true,
            sequences: {
              orderBy: { created_at: "desc" },
              take: 1,
              select: {
                id: true,
                status: true,
                steps: {
                  orderBy: { step_number: "asc" },
                  select: {
                    step_number: true,
                    status: true,
                    subject: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const items = records.map((r) => {
      const seq = r.prospect.sequences && r.prospect.sequences.length > 0 ? r.prospect.sequences[0] : null;
      const sentSteps = seq?.steps.filter((s) => s.status === "SENT") ?? [];
      const currentStep = sentSteps.length > 0 ? sentSteps[sentSteps.length - 1].step_number : 1;
      const subject = seq?.steps[0]?.subject ?? "Outreach Email";

      // Derive human-readable action taken based on classification and sequence state
      const actionTaken =
        r.reply_type === "REAL_REPLY"
          ? "Sequence Stopped & Prospect Marked Replied"
          : r.reply_type === "NEEDS_REVIEW"
          ? r.review_status === "PENDING"
            ? "Flagged for Operator Review"
            : r.review_status === "CONFIRMED_STOP"
            ? "Stopped by Operator Action"
            : "Dismissed by Operator"
          : "Ignored (Auto-Reply / OOO)";

      return {
        id: r.id,
        replyTime: r.classified_at.toISOString(),
        prospectId: r.prospect_id,
        prospectName: r.prospect.name,
        company: r.prospect.company,
        email: r.prospect.email,
        prospectStatus: r.prospect.status,
        sequenceId: seq?.id ?? null,
        sequenceStatus: seq?.status ?? "STOPPED",
        stepNumber: currentStep,
        subject,
        replyType: r.reply_type,
        confidence: r.confidence ?? 1.0,
        reason: r.reason ?? "Deterministic header & rule classification",
        recommendedAction: r.recommended_action ?? "Inspect and take action",
        actionTaken,
        reviewStatus: r.review_status,
        rawSnippet: r.raw_snippet || r.reason || "No preview snippet recorded",
        gmailThreadId: r.gmail_thread_id,
        gmailMessageId: r.gmail_message_id,
      };
    });

    return NextResponse.json({ replies: items, count: items.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to load reply classifications.";
    return NextResponse.json(
      { error: "Failed to load replies.", detail: msg },
      { status: 500 }
    );
  }
}

