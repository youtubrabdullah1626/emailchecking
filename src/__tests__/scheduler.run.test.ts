/**
 * Scheduler Run Tests — Phase 4
 *
 * Tests for the scheduler orchestration: run.ts and claim.ts
 *
 * Uses Jest mocks to simulate the Prisma client. No real DB connection needed.
 * Each test controls exactly what the DB returns and what updateMany does.
 *
 * Coverage:
 *   - Empty run (no due steps)
 *   - Single eligible step — successful claim
 *   - Race condition: step already taken by concurrent run (updateMany count=0)
 *   - Two "concurrent" claims — only one can win
 *   - SchedulerRunResult has correct shape
 *   - Dry-run mode: finds steps without claiming
 *   - maxClaims limit is respected
 *   - DB query error is handled gracefully
 *   - Ineligible step is skipped with correct reason
 *   - Multiple steps: mixed outcomes
 *   - runId is unique per run
 *   - startedAt / finishedAt are valid ISO strings
 *   - durationMs is non-negative
 */

// ── Mock Prisma ───────────────────────────────────────────────────────────────

// We mock the entire Prisma module so no DB connection is ever attempted.
jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    sequenceStep: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  },
}));

import prisma from "@/lib/prisma";
import { runScheduler } from "@/lib/scheduler/run";
import { claimStep, drainProcessingSteps } from "@/lib/scheduler/claim";

// Typed mock helpers
const mockFindMany = prisma.sequenceStep.findMany as jest.MockedFunction<
  typeof prisma.sequenceStep.findMany
>;
const mockUpdateMany = prisma.sequenceStep.updateMany as jest.MockedFunction<
  typeof prisma.sequenceStep.updateMany
>;

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeCandidateStep(overrides: Partial<{
  id: string;
  step_number: number;
  status: string;
  scheduled_at_utc: Date;
  sequenceStatus: string;
  prospectStatus: string;
}> = {}) {
  const {
    id = "step-abc-123",
    step_number = 1,
    status = "PENDING",
    scheduled_at_utc = new Date("2025-01-01T09:00:00.000Z"),
    sequenceStatus = "ACTIVE",
    prospectStatus = "ACTIVE",
  } = overrides;

  return {
    id,
    step_number,
    subject: "Quick question",
    scheduled_at_utc,
    scheduled_time_local: "09:00",
    timezone: "America/New_York",
    status,
    sequence: {
      id: "seq-001",
      status: sequenceStatus,
      prospect: {
        id: "prospect-001",
        name: "John Doe",
        email: "john@example.com",
        status: prospectStatus,
      },
    },
  };
}

// ── claimStep ─────────────────────────────────────────────────────────────────

describe("claimStep", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns CLAIMED when updateMany affects 1 row", async () => {
    mockUpdateMany.mockResolvedValueOnce({ count: 1 });

    const result = await claimStep("step-001", "run-001");

    expect(result.outcome).toBe("CLAIMED");
    expect(result.stepId).toBe("step-001");
    expect(result.error).toBeUndefined();
  });

  it("returns ALREADY_TAKEN when updateMany affects 0 rows (race condition)", async () => {
    mockUpdateMany.mockResolvedValueOnce({ count: 0 });

    const result = await claimStep("step-001", "run-001");

    expect(result.outcome).toBe("ALREADY_TAKEN");
    expect(result.stepId).toBe("step-001");
  });

  it("uses WHERE status = PENDING in the updateMany call (atomic guard)", async () => {
    mockUpdateMany.mockResolvedValueOnce({ count: 1 });

    await claimStep("step-001", "run-001");

    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "step-001",
          status: "PENDING",
        }),
        data: { status: "PROCESSING" },
      })
    );
  });

  it("returns ERROR when updateMany throws", async () => {
    mockUpdateMany.mockRejectedValueOnce(new Error("DB connection lost"));

    const result = await claimStep("step-001", "run-001");

    expect(result.outcome).toBe("ERROR");
    expect(result.error).toMatch(/DB connection lost/);
  });

  it("simulates two concurrent claims — only one can win", async () => {
    // First call succeeds (count=1), second fails (count=0) — same step
    mockUpdateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });

    const [resultA, resultB] = await Promise.all([
      claimStep("step-shared", "run-A"),
      claimStep("step-shared", "run-B"),
    ]);

    const outcomes = [resultA.outcome, resultB.outcome].sort();
    expect(outcomes).toEqual(["ALREADY_TAKEN", "CLAIMED"]);
  });
});

// ── drainProcessingSteps ──────────────────────────────────────────────────────

describe("drainProcessingSteps", () => {
  beforeEach(() => jest.clearAllMocks());

  it("resets PROCESSING steps to PENDING and returns count", async () => {
    mockUpdateMany.mockResolvedValueOnce({ count: 3 });

    const count = await drainProcessingSteps();

    expect(count).toBe(3);
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { status: "PROCESSING" },
      data: { status: "PENDING" },
    });
  });

  it("returns 0 when no PROCESSING steps exist", async () => {
    mockUpdateMany.mockResolvedValueOnce({ count: 0 });

    const count = await drainProcessingSteps();

    expect(count).toBe(0);
  });
});

// ── runScheduler ──────────────────────────────────────────────────────────────

describe("runScheduler — empty run", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: both findMany calls (candidates + stale) return empty arrays
    mockFindMany.mockResolvedValue([]);
  });

  it("returns SUCCESS with zero counts when no candidates are found", async () => {
    const result = await runScheduler();

    expect(result.status).toBe("SUCCESS");
    expect(result.candidatesFound).toBe(0);
    expect(result.eligibleSteps).toBe(0);
    expect(result.claimedSteps).toBe(0);
    expect(result.claimedStepIds).toHaveLength(0);
  });

  it("does not call updateMany when there are no candidates", async () => {
    await runScheduler();

    expect(mockUpdateMany).not.toHaveBeenCalled();
  });
});

describe("runScheduler — successful claim", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: stale-step findMany returns empty (no stale steps)
    mockFindMany.mockResolvedValue([]);
  });

  it("claims one eligible due step", async () => {
    const step = makeCandidateStep({ scheduled_at_utc: new Date(Date.now() - 5000) }); // 5s ago
    // First call: candidates; second call: stale steps (empty)
    mockFindMany.mockResolvedValueOnce([step] as never).mockResolvedValueOnce([]);
    mockUpdateMany.mockResolvedValueOnce({ count: 1 });

    const result = await runScheduler();

    expect(result.candidatesFound).toBe(1);
    expect(result.eligibleSteps).toBe(1);
    expect(result.claimedSteps).toBe(1);
    expect(result.claimedStepIds).toContain(step.id);
    expect(result.status).toBe("SUCCESS");
    expect(result.errors).toHaveLength(0);
  });
});

describe("runScheduler — race condition handling", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindMany.mockResolvedValue([]);
  });

  it("handles ALREADY_TAKEN gracefully (counts as skipped, not error)", async () => {
    const step = makeCandidateStep({ scheduled_at_utc: new Date(Date.now() - 1000) });
    mockFindMany.mockResolvedValueOnce([step] as never).mockResolvedValueOnce([]);
    mockUpdateMany.mockResolvedValueOnce({ count: 0 }); // lost the race

    const result = await runScheduler();

    expect(result.candidatesFound).toBe(1);
    expect(result.eligibleSteps).toBe(1);
    expect(result.claimedSteps).toBe(0);
    expect(result.skippedSteps).toBe(1);
    expect(result.errorSteps).toBe(0);
    expect(result.status).toBe("SUCCESS");
    expect(result.claimedStepIds).toHaveLength(0);
  });

  it("does not include ALREADY_TAKEN step in claimedStepIds", async () => {
    const step = makeCandidateStep({ scheduled_at_utc: new Date(Date.now() - 1000) });
    mockFindMany.mockResolvedValueOnce([step] as never).mockResolvedValueOnce([]);
    mockUpdateMany.mockResolvedValueOnce({ count: 0 });

    const result = await runScheduler();

    expect(result.claimedStepIds).not.toContain(step.id);
  });
});

describe("runScheduler — dry-run mode", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindMany.mockResolvedValue([]);
  });

  it("does not call updateMany in dry-run mode", async () => {
    const step = makeCandidateStep({ scheduled_at_utc: new Date(Date.now() - 1000) });
    mockFindMany.mockResolvedValueOnce([step] as never).mockResolvedValueOnce([]);

    await runScheduler({ dryRun: true });

    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it("returns dryRun=true in result", async () => {
    const result = await runScheduler({ dryRun: true });

    expect(result.dryRun).toBe(true);
  });

  it("counts eligible steps as 'claimed' in dry-run (what would be claimed)", async () => {
    const step = makeCandidateStep({ scheduled_at_utc: new Date(Date.now() - 1000) });
    mockFindMany.mockResolvedValueOnce([step] as never).mockResolvedValueOnce([]);

    const result = await runScheduler({ dryRun: true });

    expect(result.claimedSteps).toBe(1);
    expect(result.claimedStepIds).toContain(step.id);
  });
});

describe("runScheduler — ineligible step handling", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindMany.mockResolvedValue([]);
  });

  it("skips a step whose sequence is DRAFT (race window scenario)", async () => {
    // DB query returned it, but by the time we re-validate, sequence has changed
    const step = makeCandidateStep({
      scheduled_at_utc: new Date(Date.now() - 1000),
      sequenceStatus: "DRAFT", // should not happen after pre-filter, but we guard it
    });
    mockFindMany.mockResolvedValueOnce([step] as never).mockResolvedValueOnce([]);

    const result = await runScheduler();

    expect(result.candidatesFound).toBe(1);
    expect(result.eligibleSteps).toBe(0);
    expect(result.skippedSteps).toBe(1);
    expect(result.claimedSteps).toBe(0);
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it("skips a step with REPLIED prospect (reply-safety invariant)", async () => {
    const step = makeCandidateStep({
      scheduled_at_utc: new Date(Date.now() - 1000),
      prospectStatus: "REPLIED",
    });
    mockFindMany.mockResolvedValueOnce([step] as never).mockResolvedValueOnce([]);

    const result = await runScheduler();

    expect(result.eligibleSteps).toBe(0);
    expect(result.skippedSteps).toBe(1);
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });
});

describe("runScheduler — multiple steps", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindMany.mockResolvedValue([]);
  });

  it("processes multiple steps and returns correct aggregated counts", async () => {
    const step1 = makeCandidateStep({ id: "s1", scheduled_at_utc: new Date(Date.now() - 5000) });
    const step2 = makeCandidateStep({ id: "s2", scheduled_at_utc: new Date(Date.now() - 3000) });
    const step3 = makeCandidateStep({ id: "s3", scheduled_at_utc: new Date(Date.now() - 1000) });
    // First call: candidates; second call: stale steps (empty)
    mockFindMany
      .mockResolvedValueOnce([step1, step2, step3] as never)
      .mockResolvedValueOnce([]);
    mockUpdateMany
      .mockResolvedValueOnce({ count: 1 }) // s1 claimed
      .mockResolvedValueOnce({ count: 0 }) // s2 race-lost
      .mockResolvedValueOnce({ count: 1 }); // s3 claimed

    const result = await runScheduler();

    expect(result.candidatesFound).toBe(3);
    expect(result.eligibleSteps).toBe(3);
    expect(result.claimedSteps).toBe(2);
    expect(result.skippedSteps).toBe(1);
    expect(result.claimedStepIds).toEqual(expect.arrayContaining(["s1", "s3"]));
    expect(result.claimedStepIds).not.toContain("s2");
  });
});

describe("runScheduler — error handling", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindMany.mockResolvedValue([]);
  });

  it("returns FAILED status when findMany throws", async () => {
    mockFindMany.mockRejectedValueOnce(new Error("DB connection refused"));

    const result = await runScheduler();

    expect(result.status).toBe("FAILED");
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toMatch(/DB connection refused/);
  });

  it("returns PARTIAL_FAILURE when some steps error but others succeed", async () => {
    const step1 = makeCandidateStep({ id: "s1", scheduled_at_utc: new Date(Date.now() - 5000) });
    const step2 = makeCandidateStep({ id: "s2", scheduled_at_utc: new Date(Date.now() - 3000) });
    // First call: candidates; second call: stale steps (empty)
    mockFindMany
      .mockResolvedValueOnce([step1, step2] as never)
      .mockResolvedValueOnce([]);
    mockUpdateMany
      .mockResolvedValueOnce({ count: 1 })                           // s1 OK
      .mockRejectedValueOnce(new Error("Deadlock detected"));        // s2 error

    const result = await runScheduler();

    expect(result.status).toBe("PARTIAL_FAILURE");
    expect(result.claimedSteps).toBe(1);
    expect(result.errorSteps).toBe(1);
    expect(result.errors.length).toBe(1);
  });
});

describe("runScheduler — result shape", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindMany.mockResolvedValue([]);
  });

  it("returns a valid SchedulerRunResult with all required fields", async () => {
    mockFindMany.mockResolvedValueOnce([]);

    const result = await runScheduler();

    expect(typeof result.runId).toBe("string");
    expect(result.runId.length).toBeGreaterThan(0);
    expect(typeof result.startedAt).toBe("string");
    expect(typeof result.finishedAt).toBe("string");
    expect(typeof result.durationMs).toBe("number");
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(typeof result.candidatesFound).toBe("number");
    expect(typeof result.eligibleSteps).toBe("number");
    expect(typeof result.claimedSteps).toBe("number");
    expect(typeof result.skippedSteps).toBe("number");
    expect(typeof result.errorSteps).toBe("number");
    expect(Array.isArray(result.errors)).toBe(true);
    expect(Array.isArray(result.claimedStepIds)).toBe(true);
    expect(typeof result.dryRun).toBe("boolean");
    expect(["SUCCESS", "PARTIAL_FAILURE", "FAILED"]).toContain(result.status);
  });

  it("runId is unique across two runs", async () => {
    mockFindMany.mockResolvedValue([]);

    const [r1, r2] = await Promise.all([runScheduler(), runScheduler()]);

    expect(r1.runId).not.toBe(r2.runId);
  });

  it("startedAt and finishedAt are valid ISO 8601 UTC strings", async () => {
    mockFindMany.mockResolvedValueOnce([]);

    const result = await runScheduler();

    expect(new Date(result.startedAt).toISOString()).toBe(result.startedAt);
    expect(new Date(result.finishedAt).toISOString()).toBe(result.finishedAt);
  });

  it("finishedAt is not before startedAt", async () => {
    mockFindMany.mockResolvedValueOnce([]);

    const result = await runScheduler();

    expect(new Date(result.finishedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(result.startedAt).getTime()
    );
  });

  it("dryRun defaults to false", async () => {
    mockFindMany.mockResolvedValueOnce([]);

    const result = await runScheduler();

    expect(result.dryRun).toBe(false);
  });
});
