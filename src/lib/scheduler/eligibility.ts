/**
 * Scheduler Eligibility — Pure Business Rule Functions
 *
 * This is the single source of truth for all scheduler eligibility decisions.
 * These are pure functions: no database access, no HTTP, no side effects.
 *
 * The scheduler enforces three layers of gating:
 *
 *   1. PROSPECT LAYER  — prospect must be ACTIVE
 *   2. SEQUENCE LAYER  — sequence must be ACTIVE
 *   3. STEP LAYER      — step must be PENDING and scheduled_at_utc <= now
 *
 * Layer 1 is the outermost — if the prospect has replied, no step in their
 * sequence is ever eligible regardless of sequence or step status.
 *
 * These functions are designed to be imported and tested independently.
 * The DB query in query.ts pre-filters using the same rules as a performance
 * optimisation — the eligibility check here is the authoritative guard that
 * runs again after each step is fetched, protecting against race windows.
 */

// ── Valid terminal status sets ────────────────────────────────────────────────

/**
 * ProspectStatus values that permanently block all scheduling for that prospect.
 * Any status in this set means: do not send any email to this person.
 */
export const BLOCKING_PROSPECT_STATUSES = new Set<string>([
  "REPLIED",
  "STOPPED",
  "COMPLETED",
]);

/**
 * SequenceStatus values that block scheduling.
 * Only ACTIVE sequences can produce due steps.
 */
export const BLOCKING_SEQUENCE_STATUSES = new Set([
  "DRAFT",
  "STOPPED",
  "COMPLETED",
]);

/**
 * StepStatus values that block scheduling.
 * Only PENDING steps are eligible for claiming.
 * PROCESSING is NOT in this set because it is the state we are transitioning TO —
 * the eligibility check runs before claiming and only considers PENDING steps.
 */
export const BLOCKING_STEP_STATUSES = new Set([
  "PROCESSING", // already claimed by another scheduler run
  "RETRYABLE_FAILURE",
  "UNCERTAIN",
  "SENT",
  "FAILED",     // not automatically retried — requires manual admin reset
  "SKIPPED",
  "CANCELLED",
]);

// ── Eligibility result ────────────────────────────────────────────────────────

export interface EligibilityResult {
  eligible: boolean;
  reason: string;
}

// ── Layer checks (separated for individual testability) ───────────────────────

export function isProspectEligible(prospectStatus: string): EligibilityResult {
  if (BLOCKING_PROSPECT_STATUSES.has(prospectStatus)) {
    return {
      eligible: false,
      reason: `Prospect status is "${prospectStatus}" — blocked by reply-safety or completion invariants.`,
    };
  }
  return { eligible: true, reason: "Prospect is ACTIVE." };
}

/** Check sequence-level eligibility. */
export function isSequenceEligible(sequenceStatus: string): EligibilityResult {
  if (BLOCKING_SEQUENCE_STATUSES.has(sequenceStatus)) {
    return {
      eligible: false,
      reason: `Sequence status is "${sequenceStatus}" — only ACTIVE sequences are scheduled.`,
    };
  }
  return { eligible: true, reason: "Sequence is ACTIVE." };
}

/**
 * Check step-level eligibility.
 * Does NOT check the scheduled time — use isStepDue for that.
 */
export function isStepStatusEligible(stepStatus: string): EligibilityResult {
  if (BLOCKING_STEP_STATUSES.has(stepStatus)) {
    return {
      eligible: false,
      reason: `Step status is "${stepStatus}" — only PENDING steps are claimed by the scheduler.`,
    };
  }
  if (stepStatus !== "PENDING") {
    // Unknown status — block as a safety default
    return {
      eligible: false,
      reason: `Step status is "${stepStatus}" — unknown status, blocked by default.`,
    };
  }
  return { eligible: true, reason: "Step is PENDING." };
}

/**
 * Check whether a step's scheduled time has arrived.
 * Uses UTC exclusively. The IANA timezone field is for display only.
 *
 * @param scheduledAtUtc — the exact UTC moment to fire
 * @param nowUtc         — the current UTC time (injected for testability)
 *
 * Due condition: scheduledAtUtc <= nowUtc  (inclusive boundary)
 */
export function isStepDue(scheduledAtUtc: Date, nowUtc: Date): EligibilityResult {
  const overdueMs = nowUtc.getTime() - scheduledAtUtc.getTime();
  if (overdueMs < 0) {
    return {
      eligible: false,
      reason: `Step is not yet due. Scheduled at ${scheduledAtUtc.toISOString()}, current time ${nowUtc.toISOString()} (${Math.abs(overdueMs)}ms early).`,
    };
  }
  return {
    eligible: true,
    reason: `Step is due. Scheduled at ${scheduledAtUtc.toISOString()}, overdue by ${overdueMs}ms.`,
  };
}

/**
 * Full eligibility check — all four layers combined.
 * Returns the first failing layer for clear error messages.
 *
 * This is the authoritative function used by the scheduler.
 * All four conditions must be true for a step to be claimed.
 */
export function isStepFullyEligible(
  step: { status: string; scheduled_at_utc: Date },
  sequence: { status: string },
  prospect: { status: string },
  nowUtc: Date
): EligibilityResult {
  // Layer 1 — prospect (outermost guard: reply-safety invariant)
  const prospectCheck = isProspectEligible(prospect.status);
  if (!prospectCheck.eligible) return prospectCheck;

  // Layer 2 — sequence
  const sequenceCheck = isSequenceEligible(sequence.status);
  if (!sequenceCheck.eligible) return sequenceCheck;

  // Layer 3 — step status
  const stepStatusCheck = isStepStatusEligible(step.status);
  if (!stepStatusCheck.eligible) return stepStatusCheck;

  // Layer 4 — time (innermost check — only reached if all statuses pass)
  return isStepDue(step.scheduled_at_utc, nowUtc);
}
