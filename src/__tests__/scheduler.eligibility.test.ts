/**
 * Scheduler Eligibility Tests — Phase 4
 *
 * Tests for src/lib/scheduler/eligibility.ts
 *
 * Pure unit tests — no database, no network, no side effects.
 * All functions are pure (injected time) so test results are deterministic.
 *
 * Coverage:
 *   - isProspectEligible  — all 4 prospect statuses
 *   - isSequenceEligible  — all 4 sequence statuses
 *   - isStepStatusEligible — all 6 step statuses (including PROCESSING)
 *   - isStepDue           — time boundary precision
 *   - isStepFullyEligible — combined checks + layer ordering
 *   - Reply-safety invariant (prospect layer is outermost)
 */

import {
  isProspectEligible,
  isSequenceEligible,
  isStepStatusEligible,
  isStepDue,
  isStepFullyEligible,
  BLOCKING_PROSPECT_STATUSES,
  BLOCKING_SEQUENCE_STATUSES,
  BLOCKING_STEP_STATUSES,
} from "@/lib/scheduler/eligibility";

// ── Reference times for time-boundary tests ───────────────────────────────────

const SCHEDULED_UTC = new Date("2025-06-15T14:00:00.000Z");
const ONE_SECOND_BEFORE = new Date("2025-06-15T13:59:59.000Z");
const EXACTLY_AT_SCHEDULED = new Date("2025-06-15T14:00:00.000Z");
const ONE_SECOND_AFTER = new Date("2025-06-15T14:00:01.000Z");
const ONE_HOUR_AFTER = new Date("2025-06-15T15:00:00.000Z");
const ONE_DAY_AFTER = new Date("2025-06-16T14:00:00.000Z");

// ── Blocking set constants ────────────────────────────────────────────────────

describe("Blocking status sets", () => {
  it("blocks REPLIED, STOPPED, COMPLETED prospects", () => {
    expect(BLOCKING_PROSPECT_STATUSES.has("REPLIED")).toBe(true);
    expect(BLOCKING_PROSPECT_STATUSES.has("STOPPED")).toBe(true);
    expect(BLOCKING_PROSPECT_STATUSES.has("COMPLETED")).toBe(true);
  });

  it("does not block ACTIVE prospect", () => {
    expect(BLOCKING_PROSPECT_STATUSES.has("ACTIVE")).toBe(false);
  });

  it("blocks DRAFT, STOPPED, COMPLETED sequences", () => {
    expect(BLOCKING_SEQUENCE_STATUSES.has("DRAFT")).toBe(true);
    expect(BLOCKING_SEQUENCE_STATUSES.has("STOPPED")).toBe(true);
    expect(BLOCKING_SEQUENCE_STATUSES.has("COMPLETED")).toBe(true);
  });

  it("does not block ACTIVE sequence", () => {
    expect(BLOCKING_SEQUENCE_STATUSES.has("ACTIVE")).toBe(false);
  });

  it("blocks PROCESSING, SENT, FAILED, SKIPPED, CANCELLED steps", () => {
    expect(BLOCKING_STEP_STATUSES.has("PROCESSING")).toBe(true);
    expect(BLOCKING_STEP_STATUSES.has("SENT")).toBe(true);
    expect(BLOCKING_STEP_STATUSES.has("FAILED")).toBe(true);
    expect(BLOCKING_STEP_STATUSES.has("SKIPPED")).toBe(true);
    expect(BLOCKING_STEP_STATUSES.has("CANCELLED")).toBe(true);
  });

  it("does not block PENDING step", () => {
    expect(BLOCKING_STEP_STATUSES.has("PENDING")).toBe(false);
  });
});

// ── isProspectEligible ────────────────────────────────────────────────────────

describe("isProspectEligible", () => {
  it("allows ACTIVE prospect", () => {
    const result = isProspectEligible("ACTIVE");
    expect(result.eligible).toBe(true);
  });

  it("blocks REPLIED prospect (reply-safety invariant)", () => {
    const result = isProspectEligible("REPLIED");
    expect(result.eligible).toBe(false);
    expect(result.reason).toMatch(/REPLIED/);
  });

  it("blocks STOPPED prospect", () => {
    const result = isProspectEligible("STOPPED");
    expect(result.eligible).toBe(false);
    expect(result.reason).toMatch(/STOPPED/);
  });

  it("blocks COMPLETED prospect", () => {
    const result = isProspectEligible("COMPLETED");
    expect(result.eligible).toBe(false);
    expect(result.reason).toMatch(/COMPLETED/);
  });

  it("returns a reason string for blocking", () => {
    const result = isProspectEligible("REPLIED");
    expect(typeof result.reason).toBe("string");
    expect(result.reason.length).toBeGreaterThan(0);
  });
});

// ── isSequenceEligible ────────────────────────────────────────────────────────

describe("isSequenceEligible", () => {
  it("allows ACTIVE sequence", () => {
    const result = isSequenceEligible("ACTIVE");
    expect(result.eligible).toBe(true);
  });

  it("blocks DRAFT sequence", () => {
    const result = isSequenceEligible("DRAFT");
    expect(result.eligible).toBe(false);
    expect(result.reason).toMatch(/DRAFT/);
  });

  it("blocks STOPPED sequence", () => {
    const result = isSequenceEligible("STOPPED");
    expect(result.eligible).toBe(false);
  });

  it("blocks COMPLETED sequence", () => {
    const result = isSequenceEligible("COMPLETED");
    expect(result.eligible).toBe(false);
  });
});

// ── isStepStatusEligible ──────────────────────────────────────────────────────

describe("isStepStatusEligible", () => {
  it("allows PENDING step", () => {
    const result = isStepStatusEligible("PENDING");
    expect(result.eligible).toBe(true);
  });

  it("blocks PROCESSING step — already claimed by another run", () => {
    const result = isStepStatusEligible("PROCESSING");
    expect(result.eligible).toBe(false);
    expect(result.reason).toMatch(/PROCESSING/);
  });

  it("blocks SENT step", () => {
    const result = isStepStatusEligible("SENT");
    expect(result.eligible).toBe(false);
  });

  it("blocks FAILED step — not automatically retried by scheduler", () => {
    const result = isStepStatusEligible("FAILED");
    expect(result.eligible).toBe(false);
    expect(result.reason).toMatch(/FAILED/);
  });

  it("blocks SKIPPED step", () => {
    const result = isStepStatusEligible("SKIPPED");
    expect(result.eligible).toBe(false);
  });

  it("blocks CANCELLED step", () => {
    const result = isStepStatusEligible("CANCELLED");
    expect(result.eligible).toBe(false);
  });

  it("blocks unknown status by default (safety default)", () => {
    const result = isStepStatusEligible("MADE_UP_STATUS");
    expect(result.eligible).toBe(false);
  });
});

// ── isStepDue ─────────────────────────────────────────────────────────────────

describe("isStepDue — time boundary precision", () => {
  it("step is NOT due when now is 1 second before scheduled time", () => {
    const result = isStepDue(SCHEDULED_UTC, ONE_SECOND_BEFORE);
    expect(result.eligible).toBe(false);
    expect(result.reason).toMatch(/not yet due/i);
  });

  it("step IS due when now is exactly at the scheduled time (inclusive boundary)", () => {
    const result = isStepDue(EXACTLY_AT_SCHEDULED, EXACTLY_AT_SCHEDULED);
    expect(result.eligible).toBe(true);
  });

  it("step IS due when now is 1 second after scheduled time", () => {
    const result = isStepDue(SCHEDULED_UTC, ONE_SECOND_AFTER);
    expect(result.eligible).toBe(true);
  });

  it("step IS due when now is 1 hour after scheduled time (overdue)", () => {
    const result = isStepDue(SCHEDULED_UTC, ONE_HOUR_AFTER);
    expect(result.eligible).toBe(true);
  });

  it("step IS due when now is 1 day after scheduled time (very overdue)", () => {
    const result = isStepDue(SCHEDULED_UTC, ONE_DAY_AFTER);
    expect(result.eligible).toBe(true);
  });

  it("reason includes scheduled timestamp when not due", () => {
    const result = isStepDue(SCHEDULED_UTC, ONE_SECOND_BEFORE);
    expect(result.reason).toContain(SCHEDULED_UTC.toISOString());
  });

  it("works correctly with UTC midnight as scheduled time", () => {
    const midnight = new Date("2025-06-15T00:00:00.000Z");
    const oneSecBefore = new Date("2025-06-14T23:59:59.000Z");
    const oneSecAfter = new Date("2025-06-15T00:00:01.000Z");
    expect(isStepDue(midnight, oneSecBefore).eligible).toBe(false);
    expect(isStepDue(midnight, midnight).eligible).toBe(true);
    expect(isStepDue(midnight, oneSecAfter).eligible).toBe(true);
  });

  it("uses UTC exclusively — does not depend on system locale", () => {
    // Both inputs are UTC Date objects — the result should never depend on
    // the server's local timezone. If the DST calculation happened here,
    // this test would be flaky across environments.
    const utcDate = new Date(Date.UTC(2025, 0, 15, 9, 0, 0, 0)); // 09:00 UTC
    const utcNow  = new Date(Date.UTC(2025, 0, 15, 9, 0, 0, 1)); // 09:00:00.001 UTC
    expect(isStepDue(utcDate, utcNow).eligible).toBe(true);
  });
});

// ── isStepFullyEligible ───────────────────────────────────────────────────────

describe("isStepFullyEligible — combined eligibility", () => {
  const activeProspect = { status: "ACTIVE" };
  const activeSequence = { status: "ACTIVE" };
  const pendingStepDue = {
    status: "PENDING",
    scheduled_at_utc: SCHEDULED_UTC,
  };
  const nowAfterScheduled = ONE_SECOND_AFTER;

  it("returns eligible=true when all four conditions pass", () => {
    const result = isStepFullyEligible(
      pendingStepDue,
      activeSequence,
      activeProspect,
      nowAfterScheduled
    );
    expect(result.eligible).toBe(true);
  });

  // ── Reply-safety invariant ─────────────────────────────────────────────────

  it("blocks when prospect has REPLIED — even if sequence is ACTIVE and step is PENDING", () => {
    const result = isStepFullyEligible(
      pendingStepDue,
      { status: "ACTIVE" },
      { status: "REPLIED" },
      nowAfterScheduled
    );
    expect(result.eligible).toBe(false);
    expect(result.reason).toMatch(/REPLIED/);
  });

  it("blocks when prospect is STOPPED", () => {
    const result = isStepFullyEligible(
      pendingStepDue,
      activeSequence,
      { status: "STOPPED" },
      nowAfterScheduled
    );
    expect(result.eligible).toBe(false);
  });

  it("blocks when prospect is COMPLETED", () => {
    const result = isStepFullyEligible(
      pendingStepDue,
      activeSequence,
      { status: "COMPLETED" },
      nowAfterScheduled
    );
    expect(result.eligible).toBe(false);
  });

  // ── Sequence status ────────────────────────────────────────────────────────

  it("blocks when sequence is DRAFT", () => {
    const result = isStepFullyEligible(
      pendingStepDue,
      { status: "DRAFT" },
      activeProspect,
      nowAfterScheduled
    );
    expect(result.eligible).toBe(false);
  });

  it("blocks when sequence is STOPPED", () => {
    const result = isStepFullyEligible(
      pendingStepDue,
      { status: "STOPPED" },
      activeProspect,
      nowAfterScheduled
    );
    expect(result.eligible).toBe(false);
  });

  it("blocks when sequence is COMPLETED", () => {
    const result = isStepFullyEligible(
      pendingStepDue,
      { status: "COMPLETED" },
      activeProspect,
      nowAfterScheduled
    );
    expect(result.eligible).toBe(false);
  });

  // ── Step status ────────────────────────────────────────────────────────────

  it("blocks when step is PROCESSING (already claimed)", () => {
    const result = isStepFullyEligible(
      { ...pendingStepDue, status: "PROCESSING" },
      activeSequence,
      activeProspect,
      nowAfterScheduled
    );
    expect(result.eligible).toBe(false);
  });

  it("blocks when step is SENT", () => {
    const result = isStepFullyEligible(
      { ...pendingStepDue, status: "SENT" },
      activeSequence,
      activeProspect,
      nowAfterScheduled
    );
    expect(result.eligible).toBe(false);
  });

  it("blocks when step is FAILED — not automatically retried", () => {
    const result = isStepFullyEligible(
      { ...pendingStepDue, status: "FAILED" },
      activeSequence,
      activeProspect,
      nowAfterScheduled
    );
    expect(result.eligible).toBe(false);
  });

  it("blocks when step is SKIPPED", () => {
    const result = isStepFullyEligible(
      { ...pendingStepDue, status: "SKIPPED" },
      activeSequence,
      activeProspect,
      nowAfterScheduled
    );
    expect(result.eligible).toBe(false);
  });

  it("blocks when step is CANCELLED", () => {
    const result = isStepFullyEligible(
      { ...pendingStepDue, status: "CANCELLED" },
      activeSequence,
      activeProspect,
      nowAfterScheduled
    );
    expect(result.eligible).toBe(false);
  });

  // ── Time check ────────────────────────────────────────────────────────────

  it("blocks when step is PENDING but not yet due", () => {
    const result = isStepFullyEligible(
      pendingStepDue,
      activeSequence,
      activeProspect,
      ONE_SECOND_BEFORE  // now is before scheduled time
    );
    expect(result.eligible).toBe(false);
  });

  it("allows when step is PENDING and exactly at scheduled time", () => {
    const result = isStepFullyEligible(
      pendingStepDue,
      activeSequence,
      activeProspect,
      EXACTLY_AT_SCHEDULED
    );
    expect(result.eligible).toBe(true);
  });

  // ── Layer ordering — prospect is outermost ─────────────────────────────────

  it("returns prospect-layer failure when both prospect and sequence are wrong", () => {
    // The first failing layer (prospect) should be returned, not the sequence layer
    const result = isStepFullyEligible(
      pendingStepDue,
      { status: "DRAFT" },
      { status: "REPLIED" },
      nowAfterScheduled
    );
    expect(result.eligible).toBe(false);
    // Should mention REPLIED (prospect layer), not DRAFT (sequence layer)
    expect(result.reason).toMatch(/REPLIED/);
  });

  it("returns a descriptive reason for all blocking cases", () => {
    const cases = [
      [{ ...pendingStepDue, status: "SENT" }, activeSequence, { status: "REPLIED" }],
      [pendingStepDue, { status: "DRAFT" }, activeProspect],
      [{ ...pendingStepDue, status: "CANCELLED" }, activeSequence, activeProspect],
    ] as const;

    for (const [step, seq, prospect] of cases) {
      const result = isStepFullyEligible(step as { status: string; scheduled_at_utc: Date }, seq, prospect, nowAfterScheduled);
      expect(result.eligible).toBe(false);
      expect(typeof result.reason).toBe("string");
      expect(result.reason.length).toBeGreaterThan(0);
    }
  });
});
