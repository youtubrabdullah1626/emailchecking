/**
 * Operator Review Queue — Backend Domain Logic (Phase 7)
 *
 * Implements operator review queries and validated review actions.
 *
 * NON-NEGOTIABLE ARCHITECTURE:
 *   - Human operator actions pass through strict server-side validation.
 *   - CONFIRM_STOP delegates directly to the existing atomic applyReplyStop() transaction.
 *   - NO secondary stop logic is created.
 *   - NO unapproved status changes or fake actions are performed.
 *   - All actions are strictly idempotent.
 *
 * Server-side only.
 */

import prisma from "@/lib/prisma";
import { applyReplyStop } from "./stop";
import { replyLog } from "./logger";
import type { ReplyType, ReviewStatus } from "@prisma/client";

export type OperatorReviewAction = "CONFIRM_STOP" | "KEEP_ACTIVE" | "DISMISS";

export interface PendingReviewItem {
  id: string;
  prospectId: string;
  prospectName: string;
  prospectCompany: string;
  prospectEmail: string;
  subject: string;
  sequenceId: string;
  sequenceStatus: string;
  gmailThreadId: string;
  gmailMessageId: string;
  replyType: ReplyType;
  confidence: number | null;
  reason: string | null;
  recommendedAction: string | null;
  signals: string[];
  reviewStatus: ReviewStatus;
  rawSnippet: string | null;
  classifiedAt: string;
}

export interface ReviewActionResult {
  ok: boolean;
  reviewId: string;
  action: OperatorReviewAction;
  message: string;
  stepsCancelled?: number;
  newReviewStatus: ReviewStatus;
}

/**
 * Load all pending reply reviews requiring operator attention.
 * Filter: reply_type = 'NEEDS_REVIEW' AND review_status = 'PENDING'
 * Ordered by classified_at DESC (newest first).
 */
export async function getPendingReviews(): Promise<PendingReviewItem[]> {
  const records = await prisma.replyClassification.findMany({
    where: {
      reply_type: "NEEDS_REVIEW",
      review_status: "PENDING",
    },
    orderBy: { classified_at: "desc" },
    include: {
      prospect: {
        select: {
          id: true,
          name: true,
          company: true,
          email: true,
          sequences: {
            orderBy: { created_at: "desc" },
            take: 1,
            select: {
              id: true,
              status: true,
              steps: {
                where: { status: "SENT" },
                orderBy: { sent_at: "desc" },
                take: 1,
                select: { subject: true },
              },
            },
          },
        },
      },
    },
  });

  return records.map((r) => {
    let signalsArray: string[] = [];
    if (Array.isArray(r.signals)) {
      signalsArray = r.signals.filter((s): s is string => typeof s === "string");
    }

    const latestStep = r.prospect.sequences?.[0]?.steps?.[0];
    const subject = latestStep ? `Re: ${latestStep.subject}` : "Unknown Subject";

    return {
      id: r.id,
      prospectId: r.prospect_id,
      prospectName: r.prospect.name,
      prospectCompany: r.prospect.company,
      prospectEmail: r.prospect.email,
      subject,
      sequenceId: r.prospect.sequences?.[0]?.id ?? "",
      sequenceStatus: r.prospect.sequences?.[0]?.status ?? "UNKNOWN",
      gmailThreadId: r.gmail_thread_id,
      gmailMessageId: r.gmail_message_id,
      replyType: r.reply_type,
      confidence: r.confidence,
      reason: r.reason,
      recommendedAction: r.recommended_action,
      signals: signalsArray,
      reviewStatus: r.review_status,
      rawSnippet: r.raw_snippet,
      classifiedAt: r.classified_at.toISOString(),
    };
  });
}

/**
 * Process a human operator review decision.
 *
 * @param reviewId — ID of the ReplyClassification record
 * @param action   — CONFIRM_STOP | KEEP_ACTIVE | DISMISS
 */
export async function processOperatorReviewAction(
  reviewId: string,
  action: OperatorReviewAction
): Promise<ReviewActionResult> {
  const existing = await prisma.replyClassification.findUnique({
    where: { id: reviewId },
    include: {
      prospect: {
        select: {
          id: true,
          email: true,
          sequences: {
            orderBy: { created_at: "desc" },
            take: 1,
            select: { id: true, status: true },
          },
        },
      },
    },
  });

  if (!existing) {
    return {
      ok: false,
      reviewId,
      action,
      message: "Review item not found.",
      newReviewStatus: "PENDING",
    };
  }

  // Idempotency check: if already processed, return clean status
  if (existing.review_status !== "PENDING") {
    return {
      ok: true,
      reviewId,
      action,
      message: `Review item was already processed with status "${existing.review_status}".`,
      newReviewStatus: existing.review_status,
    };
  }

  const now = new Date();
  const sequenceId = existing.prospect.sequences?.[0]?.id;
  const prospectId = existing.prospect_id;

  replyLog("review_created", {
    gmailMessageId: existing.gmail_message_id,
    prospectId,
    sequenceId,
    action,
  });

  switch (action) {
    case "CONFIRM_STOP": {
      if (!sequenceId) {
        return {
          ok: false,
          reviewId,
          action,
          message: "No sequence associated with this prospect.",
          newReviewStatus: "PENDING",
        };
      }

      // Execute existing atomic applyReplyStop transaction
      const stopResult = await applyReplyStop(sequenceId, prospectId, {
        gmailMessageId: existing.gmail_message_id,
        gmailThreadId: existing.gmail_thread_id,
        fromEmail: existing.prospect.email,
        fromHeader: existing.prospect.email,
        subject: "Operator Confirmed Reply",
        snippet: existing.raw_snippet ?? "",
        replyType: "REAL_REPLY",
        reason: existing.reason ?? "Operator confirmed reply from review queue.",
      });

      // Update review status to CONFIRMED_STOP
      await prisma.replyClassification.update({
        where: { id: reviewId },
        data: {
          review_status: "CONFIRMED_STOP",
          reviewed_at: now,
        },
      });

      replyLog("manual_review_completed", {
        reviewId,
        prospectId,
        sequenceId,
        action,
        stepsCancelled: stopResult.stepsCancelled,
      });

      return {
        ok: true,
        reviewId,
        action,
        message: `Sequence stopped. Cancelled ${stopResult.stepsCancelled} pending/processing step(s).`,
        stepsCancelled: stopResult.stepsCancelled,
        newReviewStatus: "CONFIRMED_STOP",
      };
    }

    case "KEEP_ACTIVE": {
      await prisma.replyClassification.update({
        where: { id: reviewId },
        data: {
          review_status: "CONFIRMED_KEEP_ACTIVE",
          reviewed_at: now,
        },
      });

      replyLog("manual_review_completed", {
        reviewId,
        prospectId,
        sequenceId,
        action,
      });

      return {
        ok: true,
        reviewId,
        action,
        message: "Marked as keep active. Sequence remains active.",
        newReviewStatus: "CONFIRMED_KEEP_ACTIVE",
      };
    }

    case "DISMISS": {
      await prisma.replyClassification.update({
        where: { id: reviewId },
        data: {
          review_status: "DISMISSED",
          reviewed_at: now,
        },
      });

      replyLog("manual_review_completed", {
        reviewId,
        prospectId,
        sequenceId,
        action,
      });

      return {
        ok: true,
        reviewId,
        action,
        message: "Review dismissed.",
        newReviewStatus: "DISMISSED",
      };
    }
  }
}
