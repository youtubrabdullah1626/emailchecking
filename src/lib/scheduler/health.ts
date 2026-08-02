/**
 * Scheduler Health — Operational State Reader
 *
 * Returns real-time health metrics derived from the database.
 * Used by the cron route and dashboard stats to report scheduler state.
 *
 * This is a pure read — no mutations.
 * Server-side only.
 */

import prisma from "@/lib/prisma";

export interface SchedulerHealth {
  /** Count of PENDING steps that are currently due (scheduled_at_utc <= now). */
  pendingDueCount: number;
  /** Count of PENDING steps that are scheduled for the future. */
  pendingFutureCount: number;
  /** Count of steps currently in PROCESSING (claimed, not yet sent). */
  processingCount: number;
  /** Count of PROCESSING steps stuck longer than STALE_THRESHOLD_MINUTES. */
  staleProcessingCount: number;
  /** Count of FAILED steps that are eligible for retry (retry_count < MAX_RETRIES). */
  retryEligibleCount: number;
  /** Count of FAILED steps that have exhausted all retry attempts. */
  retriesExhaustedCount: number;
  /** UTC timestamp of when this health snapshot was captured. */
  capturedAt: string;
}

const STALE_THRESHOLD_MINUTES = 15;
const MAX_RETRIES = 3;

/**
 * Compute a real-time scheduler health snapshot from the database.
 */
export async function getSchedulerHealth(): Promise<SchedulerHealth> {
  const nowUtc = new Date();
  const staleBeforeUtc = new Date(nowUtc.getTime() - STALE_THRESHOLD_MINUTES * 60 * 1000);

  const [
    pendingDueCount,
    pendingFutureCount,
    processingCount,
    staleProcessingCount,
    retryEligibleCount,
    retriesExhaustedCount,
  ] = await Promise.all([
    // PENDING steps that are due now
    prisma.sequenceStep.count({
      where: {
        status: "PENDING",
        scheduled_at_utc: { lte: nowUtc },
      },
    }),
    // PENDING steps scheduled in the future
    prisma.sequenceStep.count({
      where: {
        status: "PENDING",
        scheduled_at_utc: { gt: nowUtc },
      },
    }),
    // All PROCESSING steps
    prisma.sequenceStep.count({
      where: { status: "PROCESSING" },
    }),
    // Stale PROCESSING steps (stuck for > STALE_THRESHOLD_MINUTES)
    prisma.sequenceStep.count({
      where: {
        status: "PROCESSING",
        scheduled_at_utc: { lte: staleBeforeUtc },
      },
    }),
    // FAILED steps eligible for retry
    prisma.sequenceStep.count({
      where: {
        status: "FAILED",
        retry_count: { lt: MAX_RETRIES },
      },
    }),
    // FAILED steps that have exhausted retries
    prisma.sequenceStep.count({
      where: {
        status: "FAILED",
        retry_count: { gte: MAX_RETRIES },
      },
    }),
  ]);

  return {
    pendingDueCount,
    pendingFutureCount,
    processingCount,
    staleProcessingCount,
    retryEligibleCount,
    retriesExhaustedCount,
    capturedAt: nowUtc.toISOString(),
  };
}
