/**
 * Scheduler Types — Enterprise Hardened
 *
 * All types used by the scheduler engine. Centralised here to make the
 * contract between layers explicit and testable.
 */

// ── Run result ────────────────────────────────────────────────────────────────

export type SchedulerRunStatus = "SUCCESS" | "PARTIAL_FAILURE" | "FAILED";

export interface SchedulerRunResult {
  runId: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  candidatesFound: number;
  eligibleSteps: number;
  claimedSteps: number;
  skippedSteps: number;
  errorSteps: number;
  errors: string[];
  claimedStepIds: string[];
  dryRun: boolean;
  status: SchedulerRunStatus;
  staleProcessingSteps: StaleStepInfo[];
}

// ── Stale step info (Phase 8 observability) ──────────────────────────────────

export interface StaleStepInfo {
  stepId: string;
  stepNumber: number;
  sequenceId: string;
  prospectId: string;
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
  dryRun?: boolean;
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
  | "stale_processing_steps_detected"
  | "scheduler_skipped_due_to_limits"
  | "scheduler_limit_check_failed";

// ── Smart Scheduler Pure Engine Types ─────────────────────────────────────────

export enum SchedulingReason {
  BUSINESS_HOURS_SHIFT = 'BUSINESS_HOURS_SHIFT',
  WEEKEND_SHIFT = 'WEEKEND_SHIFT',
  RANDOMIZED_INTERVAL = 'RANDOMIZED_INTERVAL',
  PROVIDER_LIMIT = 'PROVIDER_LIMIT',
  WARMUP_LIMIT = 'WARMUP_LIMIT',
  OPTIMAL = 'OPTIMAL'
}

export interface BusinessHours {
  readonly activeDays: number[];
  readonly startTime: string;
  readonly endTime: string;
}

export interface SchedulingContext {
  readonly currentUtcTime: Date;
  readonly randomJitterSeconds: number;
  readonly recipientTimezone?: string;
  readonly campaignDefaultTimezone?: string;
  readonly minIntervalSeconds: number;
  readonly maxIntervalSeconds: number;
  readonly businessHours: BusinessHours;
  readonly holidayCalendar?: string[];
  readonly recipientActivityWindows?: unknown[];
  readonly providerRestrictions?: unknown;
}

export interface SchedulingDecision {
  readonly recommendedSendTimeUtc: Date;
  readonly recipientLocalTime: string;
  readonly delayAppliedSeconds: number;
  readonly appliedRules: SchedulingReason[];
}

export interface RuleResult {
  readonly newTargetTime: Date;
  readonly reason: SchedulingReason | null;
  readonly shifted: boolean;
}

export interface SchedulingRule {
  readonly name: string;
  apply(context: SchedulingContext, targetTimeZoned: Date, timezone: string): RuleResult;
}

export class SchedulerValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SchedulerValidationError';
  }
}
