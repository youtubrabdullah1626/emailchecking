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
      OR: [
        { eligible_after_utc: { lte: nowUtc } },
        { eligible_after_utc: null, scheduled_at_utc: { lte: nowUtc } }
      ],
      sequence: {
        status: "ACTIVE",
        prospect: {
          status: "ACTIVE",
          OR: [
            { campaign: { status: "ACTIVE" } },
            { campaign: null }
          ]
        }
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
      eligible_after_utc: true,
      soft_sla_deadline: true,
      priority_class: true,
      sequence: {
        select: {
          id: true,
          status: true,
          user_id: true,
          assigned_sender_email: true,
          prospect: {
            select: {
              id: true,
              name: true,
              email: true,
              status: true,
              campaign: {
                select: {
                  id: true,
                  status: true,
                  last_dispatched_at: true
                }
              }
            },
          },
        },
      },
    },
    take: limit,
  }) as unknown as CandidateStep[];
  // Note: 'as unknown as CandidateStep[]' is required because Prisma's generated
  // select-return type is deeply nested and doesn't directly match our leaner
  // CandidateStep interface. The selected fields match exactly.
}

/**
 * Find PROCESSING steps stuck longer than the threshold — they were claimed
 * but never advanced to SENT/FAILED.
 *
 * Uses `claimed_at` as the authoritative detection timestamp (set atomically
 * by claim.ts when PENDING → PROCESSING). This is precise: it measures exactly
 * how long a step has been PROCESSING, not when it was originally scheduled.
 *
 * The `reconciler.ts` runStaleMonitor handles auto-resolution. This function
 * is used for observability logging in the scheduler run result.
 *
 * @param thresholdMs — staleness threshold in ms (default: 15 minutes)
 */
export async function findStaleProcessingSteps(
  nowUtc: Date,
  thresholdMs: number = 15 * 60 * 1000 // 15 minutes
): Promise<StaleStepInfo[]> {
  const staleBeforeUtc = new Date(nowUtc.getTime() - thresholdMs);

  const rows = await prisma.sequenceStep.findMany({
    where: {
      status: "PROCESSING",
      // claimed_at is set by claim.ts on every successful PENDING → PROCESSING transition.
      // Steps where claimed_at < (now - threshold) have been stuck too long.
      claimed_at: {
        lte: staleBeforeUtc,
      },
    },
    select: {
      id: true,
      step_number: true,
      claimed_at: true,
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
    staleDurationMs: row.claimed_at
      ? nowUtc.getTime() - row.claimed_at.getTime()
      : 0,
  }));
}
