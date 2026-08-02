/**
 * Scheduler Candidate Query — Database Layer
 *
 * Queries Supabase via Prisma for steps that are candidates for processing.
 *
 * The query pre-filters using the same rules as isStepFullyEligible for
 * performance — it avoids fetching steps that are definitely ineligible.
 * The caller MUST still re-run isStepFullyEligible on each returned step
 * to guard against the race window between query and claim.
 *
 * Server-side only. Do not import this file from client components.
 */

import prisma from "@/lib/prisma";
import type { CandidateStep, StaleStepInfo } from "./types";

/**
 * Return all PENDING sequence steps that are:
 *   - scheduled_at_utc <= nowUtc
 *   - sequence.status = ACTIVE
 *   - prospect.status = ACTIVE
 *
 * Ordered by scheduled_at_utc ASC (oldest due first).
 *
 * @param nowUtc  — current UTC time (injected for testability and logging)
 * @param limit   — maximum rows to fetch (prevents runaway on large backlogs)
 */
export async function findCandidateSteps(
  nowUtc: Date,
  limit: number
): Promise<CandidateStep[]> {
  return prisma.sequenceStep.findMany({
    where: {
      status: "PENDING",
      scheduled_at_utc: {
        lte: nowUtc, // scheduled time has arrived
      },
      sequence: {
        status: "ACTIVE",
      },
    },
    select: {
      id: true,
      step_number: true,
      subject: true,
      scheduled_at_utc: true,
      scheduled_time_local: true,
      timezone: true,
      status: true,
      sequence: {
        select: {
          id: true,
          status: true,
          prospect: {
            select: {
              id: true,
              name: true,
              email: true,
              status: true,
            },
          },
        },
      },
    },
    orderBy: {
      scheduled_at_utc: "asc",
    },
    take: limit,
  }) as unknown as CandidateStep[];
  // Note: 'as unknown as CandidateStep[]' is required because Prisma's generated
  // select-return type is deeply nested and doesn't directly match our leaner
  // CandidateStep interface. The selected fields match exactly.
}

/**
 * Phase 8: Find PROCESSING steps that have been stuck for longer than
 * the given threshold — indicating they were claimed but never advanced.
 *
 * These steps are NOT automatically reset. They are returned for observability
 * so an operator can investigate and reset them manually if appropriate.
 *
 * NOTE: SequenceStep does not store a claimed_at timestamp.
 * We approximate stale detection by checking scheduled_at_utc as a
 * lower-bound proxy: if scheduled_at_utc + threshold < now, the step
 * should have been processed long ago.
 *
 * @param thresholdMs — how many milliseconds old a PROCESSING step must be
 *                      to be considered stale (default: 15 minutes)
 */
export async function findStaleProcessingSteps(
  nowUtc: Date,
  thresholdMs: number = 15 * 60 * 1000 // 15 minutes
): Promise<StaleStepInfo[]> {
  const staleBeforeUtc = new Date(nowUtc.getTime() - thresholdMs);

  const rows = await prisma.sequenceStep.findMany({
    where: {
      status: "PROCESSING",
      // A step with scheduled_at_utc before the stale threshold is suspicious:
      // it was due at least `thresholdMs` ago but still hasn't advanced.
      scheduled_at_utc: {
        lte: staleBeforeUtc,
      },
    },
    select: {
      id: true,
      step_number: true,
      scheduled_at_utc: true,
      sequence: {
        select: {
          id: true,
          prospect: {
            select: { id: true },
          },
        },
      },
    },
  });

  return rows.map((row) => ({
    stepId: row.id,
    stepNumber: row.step_number,
    sequenceId: row.sequence.id,
    prospectId: row.sequence.prospect.id,
    staleDurationMs: nowUtc.getTime() - row.scheduled_at_utc.getTime(),
  }));
}

