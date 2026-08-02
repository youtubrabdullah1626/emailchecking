/**
 * Scheduler Types — Phase 4 / Phase 8 hardened
 *
 * All types used by the scheduler engine. Centralised here to make the
 * contract between layers explicit and testable.
 */

// ── Run result ────────────────────────────────────────────────────────────────

export type SchedulerRunStatus = "SUCCESS" | "PARTIAL_FAILURE" | "FAILED";

/**
 * Structured result returned by every scheduler run.
 * Returned from the API and logged to stdout.
 */
export interface SchedulerRunResult {
  /** Unique identifier for this scheduler run (cuid). */
  runId: string;
  /** ISO 8601 UTC timestamp when the run started. */
  startedAt: string;
  /** ISO 8601 UTC timestamp when the run finished. */
  finishedAt: string;
  /** Wall-clock duration of the run in milliseconds. */
  durationMs: number;
  /** Total steps found by the initial DB query (PENDING, due, ACTIVE sequence+prospect). */
  candidatesFound: number;
  /** Steps that passed the eligibility re-check. Should equal candidatesFound unless race conditions. */
  eligibleSteps: number;
  /** Steps successfully claimed (PENDING → PROCESSING). */
  claimedSteps: number;
  /** Steps skipped because another concurrent run already claimed them (race condition losers). */
  skippedSteps: number;
  /** Steps where the claim attempt threw an unexpected error. */
  errorSteps: number;
  /** Human-readable error messages for any errorSteps. */
  errors: string[];
  /**
   * IDs of successfully claimed steps.
   * Phase 5 Gmail integration will read these and send each email,
   * then mark each as SENT (or FAILED on error).
   */
  claimedStepIds: string[];
  /** Whether this was a dry run (no state changes). */
  dryRun: boolean;
  /** Overall run status. */
  status: SchedulerRunStatus;
  /**
   * Phase 8: Steps currently stuck in PROCESSING (claimed but not advanced).
   * Observed but NOT automatically reset — manual recovery required.
   * Steps here are NOT in claimedStepIds.
   */
  staleProcessingSteps: StaleStepInfo[];
}

// ── Stale step info (Phase 8 observability) ─────────────────────────────────

export interface StaleStepInfo {
  stepId: string;
  stepNumber: number;
  sequenceId: string;
  prospectId: string;
  /** How long (in ms) the step has been stuck in PROCESSING */
  staleDurationMs: number;
}

// ── Claim result ──────────────────────────────────────────────────────────────

export type ClaimOutcome = "CLAIMED" | "ALREADY_TAKEN" | "ERROR";

export interface ClaimResult {
  stepId: string;
  outcome: ClaimOutcome;
  error?: string;
}

// ── Candidate step (returned by DB query, includes joined data) ───────────────

export interface CandidateStep {
  id: string;
  step_number: number;
  subject: string;
  scheduled_at_utc: Date;
  scheduled_time_local: string;
  timezone: string;
  status: string;
  sequence: {
    id: string;
    status: string;
    prospect: {
      id: string;
      name: string;
      email: string;
      status: string;
    };
  };
}

// ── Scheduler run options ─────────────────────────────────────────────────────

export interface SchedulerRunOptions {
  /**
   * When true, the scheduler identifies and validates due steps but does NOT
   * change any statuses. Returns what would be claimed without side effects.
   * Default: false.
   */
  dryRun?: boolean;
  /**
   * Maximum number of steps to claim in a single run.
   * Prevents runaway behaviour in large backlogs.
   * Default: 50.
   */
  maxClaims?: number;
}

// ── Log event types ───────────────────────────────────────────────────────────

export type SchedulerLogEvent =
  | "scheduler_run_started"
  | "candidates_found"
  | "step_eligible"
  | "step_not_eligible"
  | "step_claimed"
  | "step_already_taken"
  | "step_claim_error"
  | "scheduler_run_completed"
  | "scheduler_run_failed"
  | "stale_processing_steps_detected";
