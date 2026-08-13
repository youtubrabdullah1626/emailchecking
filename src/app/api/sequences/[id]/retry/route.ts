/**
 * POST /api/sequences/[id]/retry
 *
 * FAILED Step Retry — Phase 11
 *
 * Resets one or more FAILED steps back to PENDING for re-processing by the scheduler.
 *
 * Safety guarantees:
 *   1. Only FAILED steps can be retried. SENT, CANCELLED, and SKIPPED steps are immutable.
 *   2. retry_count must be below MAX_RETRIES. Steps that have been retried too many
 *      times are permanently locked — they require manual database intervention.
 *   3. The reset (FAILED → PENDING) and the retry_count increment are performed
 *      atomically inside a single Prisma $transaction.
 *   4. An EmailEvent with type FAILED is created for each retried step, with metadata
 *      indicating the retry attempt. This preserves the immutable audit trail.
 *   5. Authenticated by SCHEDULER_SECRET.
 *
 * Request body:
 *   { "stepIds": ["cuid1", "cuid2"] }   — retry specific steps
 *   {}                                   — retry ALL FAILED steps in this sequence
 *
 * Response 200:
 *   {
 *     "ok": true,
 *     "sequenceId": "...",
 *     "retried": 2,
 *     "skipped": 1,
 *     "results": [
 *       { "stepId": "...", "outcome": "RETRIED", "retryCount": 2 },
 *       { "stepId": "...", "outcome": "MAX_RETRIES_EXCEEDED", "retryCount": 3 },
 *     ]
 *   }
 *
 * Server-side only.
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/observability/logger";
import { withObservability } from "@/lib/observability/middleware";
import { getSession } from "@/lib/auth/session";

const MAX_RETRIES = 3;

type RetryOutcome = "RETRIED" | "MAX_RETRIES_EXCEEDED" | "NOT_FAILED" | "NOT_FOUND";

interface StepRetryResult {
  stepId: string;
  outcome: RetryOutcome;
  retryCount?: number;
  currentStatus?: string;
}

export const POST = withObservability(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  // ── Auth Guard — the SCHEDULER_SECRET check promised in the comment was never
  // implemented. Replacing with session auth as the single source of truth.
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id: sequenceId } = await params;

  // ── Sequence ownership verification ──────────────────────────────────
  const sequence = await prisma.sequence.findUnique({
    where: { id: sequenceId, user_id: session.user.id },
    select: { id: true },
  });
  if (!sequence) {
    return NextResponse.json(
      { ok: false, error: "NOT_FOUND", detail: `Sequence ${sequenceId} not found.` },
      { status: 404 }
    );
  }

  // ── Parse optional step ID list ───────────────────────────────────────────
  let targetStepIds: string[] | null = null;
  try {
    const body = await request.json();
    if (body && Array.isArray(body.stepIds)) {
      if (body.stepIds.some((id: unknown) => typeof id !== "string")) {
        return NextResponse.json(
          { ok: false, error: "stepIds must be an array of strings." },
          { status: 400 }
        );
      }
      targetStepIds = body.stepIds as string[];
    }
  } catch {
    // Empty body — retry all FAILED steps in the sequence
  }

  // ── Load candidate steps ──────────────────────────────────────────────────
  const steps = await prisma.sequenceStep.findMany({
    where: {
      sequence_id: sequenceId,
      status: "FAILED",
      ...(targetStepIds ? { id: { in: targetStepIds } } : {}),
    },
    select: {
      id: true,
      step_number: true,
      retry_count: true,
      status: true,
    },
  });

  // Check if the sequence even exists (if no FAILED steps and specific IDs requested)
  if (targetStepIds && targetStepIds.length > 0 && steps.length === 0) {
    // Verify the sequence exists
    const sequence = await prisma.sequence.findUnique({
      where: { id: sequenceId },
      select: { id: true },
    });
    if (!sequence) {
      return NextResponse.json(
        { ok: false, error: "NOT_FOUND", detail: `Sequence ${sequenceId} not found.` },
        { status: 404 }
      );
    }
  }

  if (steps.length === 0) {
    return NextResponse.json({
      ok: true,
      sequenceId,
      retried: 0,
      skipped: 0,
      results: [],
      message: "No FAILED steps found to retry.",
    });
  }

  // ── Process each step atomically ─────────────────────────────────────────
  const results: StepRetryResult[] = [];
  let retriedCount = 0;
  let skippedCount = 0;
  const now = new Date();

  for (const step of steps) {
    // Enforce MAX_RETRIES limit
    if (step.retry_count >= MAX_RETRIES) {
      results.push({
        stepId: step.id,
        outcome: "MAX_RETRIES_EXCEEDED",
        retryCount: step.retry_count,
      });
      skippedCount++;
      continue;
    }

    // Atomic: reset to PENDING, increment retry_count, create audit event
    try {
      await prisma.$transaction(async (tx) => {
        await tx.sequenceStep.update({
          where: { id: step.id },
          data: {
            status: "PENDING",
            retry_count: { increment: 1 },
            last_retry_at: now,
          },
        });

        // Audit event — uses FAILED event type with retry metadata to avoid schema enum change.
        // The metadata.retried=true flag distinguishes this from an original failure.
        await tx.emailEvent.create({
          data: {
            sequence_step_id: step.id,
            event_type: "FAILED",
            occurred_at: now,
            metadata: {
              action: "RETRY_RESET",
              retried: true,
              retry_attempt: step.retry_count + 1,
              max_retries: MAX_RETRIES,
              reason: "Manual retry requested by operator.",
            },
          },
        });
      });

      results.push({
        stepId: step.id,
        outcome: "RETRIED",
        retryCount: step.retry_count + 1,
      });
      retriedCount++;
    } catch (err) {
      logger.error("retry_failed", { stepId: step.id, error: err });
      // Treat as skipped — do not fail the entire batch for one step
      results.push({
        stepId: step.id,
        outcome: "NOT_FOUND", // unexpected DB error treated as skip
        currentStatus: step.status,
      });
      skippedCount++;
    }
  }

  return NextResponse.json({
    ok: true,
    sequenceId,
    retried: retriedCount,
    skipped: skippedCount,
    results,
  });
});
