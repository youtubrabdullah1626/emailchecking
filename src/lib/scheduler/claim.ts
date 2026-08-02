/**
 * Scheduler Claim — Atomic Step Acquisition
 *
 * Implements the PENDING → PROCESSING transition using PostgreSQL row-level
 * locking via Prisma's updateMany.
 *
 * ── Idempotency Guarantee ────────────────────────────────────────────────────
 *
 * Prisma generates:
 *   UPDATE sequence_steps
 *   SET status = 'PROCESSING'
 *   WHERE id = ? AND status = 'PENDING'
 *
 * PostgreSQL row-level locking ensures exactly one concurrent transaction
 * can successfully modify a given row. If two scheduler runs race:
 *
 *   Run A: UPDATE WHERE status = 'PENDING' → count = 1 → CLAIMED ✓
 *   Run B: UPDATE WHERE status = 'PENDING' → count = 0 → ALREADY_TAKEN (status is now PROCESSING)
 *
 * This is a well-established job-queue pattern in PostgreSQL.
 * No explicit transaction or advisory lock is needed.
 *
 * ── Retry Safety ─────────────────────────────────────────────────────────────
 *
 * A step claimed (PROCESSING) but not sent (e.g. process crash) remains in
 * PROCESSING. On the next scheduler run, the query filters by status=PENDING
 * so it will NOT re-discover this step. The step is not lost — it is "stuck".
 *
 * Resolution:
 *   1. Phase 4 DEV: POST /api/scheduler/drain resets PROCESSING → PENDING
 *   2. Phase 5+: A "stuck step" monitor will detect PROCESSING steps older
 *      than N minutes and reset them (with a count limit to prevent loops)
 *
 * ── What happens after claiming (Phase 5 contract) ───────────────────────────
 *
 * The Phase 5 Gmail sender will:
 *   1. Fetch all PROCESSING steps
 *   2. For each: call Gmail API, mark SENT (success) or FAILED (error)
 *   3. FAILED steps are NOT automatically retried — require manual reset
 *
 * Server-side only.
 */

import prisma from "@/lib/prisma";
import type { ClaimResult } from "./types";

/**
 * Attempt to atomically claim a single step for sending.
 *
 * @param stepId — the step to claim
 * @param runId  — the scheduler run ID (for logging/traceability)
 * @returns      ClaimResult with outcome CLAIMED | ALREADY_TAKEN | ERROR
 */
export async function claimStep(
  stepId: string,
  runId: string
): Promise<ClaimResult> {
  try {
    const result = await prisma.sequenceStep.updateMany({
      where: {
        id: stepId,
        status: "PENDING", // ← atomic guard: only matches if still PENDING
      },
      data: {
        status: "PROCESSING",
      },
    });

    if (result.count === 1) {
      return { stepId, outcome: "CLAIMED" };
    }

    // count === 0: step was already claimed by a concurrent run between
    // our findMany and this updateMany. This is expected behaviour.
    return { stepId, outcome: "ALREADY_TAKEN" };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown database error";
    console.error(`[scheduler][${runId}] claimStep error for ${stepId}:`, message);
    return {
      stepId,
      outcome: "ERROR",
      error: `Claim failed: ${message}`,
    };
  }
}

/**
 * Reset all PROCESSING steps back to PENDING.
 *
 * Phase 4 development tool only.
 * This exists so developers can re-run scheduler tests without stuck steps.
 *
 * In Phase 5+, this endpoint should be removed or protected behind authentication.
 *
 * @returns count of steps reset
 */
export async function drainProcessingSteps(): Promise<number> {
  const result = await prisma.sequenceStep.updateMany({
    where: { status: "PROCESSING" },
    data: { status: "PENDING" },
  });
  return result.count;
}
