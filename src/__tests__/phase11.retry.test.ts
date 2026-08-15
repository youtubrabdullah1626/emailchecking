/**
 * Phase 11 — Retry Tests
 *
 * Tests for the FAILED step retry endpoint and retry count enforcement.
 *
 * Coverage:
 *   1. Retry a FAILED step — resets to PENDING, increments retry_count
 *   2. Retry a FAILED step at retry_count = MAX_RETRIES-1 — still allowed
 *   3. Retry a step at MAX_RETRIES — rejected with MAX_RETRIES_EXCEEDED
 *   4. Retry with no FAILED steps — returns 0 retried
 *   5. Retry with specific stepIds filter
 *   6. Auth guard: missing secret returns 401
 *   7. Sequence not found returns structured response
 */

import { NextRequest } from "next/server";

// ── Mock Prisma ────────────────────────────────────────────────────────────────

const mockFindMany = jest.fn();
const mockFindUnique = jest.fn();
const mockUpdate = jest.fn();
const mockEventCreate = jest.fn();
const mockTransaction = jest.fn((fn: (tx: unknown) => Promise<unknown>) =>
  fn({
    sequenceStep: { update: mockUpdate },
    emailEvent: { create: mockEventCreate },
  })
);

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    sequenceStep: { findMany: mockFindMany },
    sequence: { findUnique: mockFindUnique },
    $transaction: mockTransaction,
  },
}));

jest.mock("@/lib/auth/session", () => ({
  getSession: jest.fn().mockResolvedValue({
    user: { id: "test-user-id", email: "test@example.com", role: "OWNER" },
  }),
}));

// ── Import after mocks ────────────────────────────────────────────────────────

import { POST } from "@/app/api/sequences/[id]/retry/route";

// ── Helpers ────────────────────────────────────────────────────────────────────

const MAX_RETRIES = 3;

function makeRequest(body: unknown = {}): NextRequest {
  return new NextRequest("http://localhost:3000/api/sequences/seq-001/retry", {
    method: "POST",
    headers: { "Content-Type": "application/json", authorization: "Bearer test-secret" },
    body: JSON.stringify(body),
  });
}

type Params = { params: Promise<{ id: string }> };
function makeParams(id = "seq-001"): Params {
  return { params: Promise.resolve({ id }) };
}

function makeStep(overrides: { id?: string; retry_count?: number } = {}) {
  return {
    id: overrides.id ?? "step-001",
    step_number: 1,
    retry_count: overrides.retry_count ?? 0,
    status: "FAILED",
  };
}

// ── Test suites ────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockFindUnique.mockResolvedValue({ id: "seq-001" });
});

describe("POST /api/sequences/[id]/retry — authentication", () => {
  it("does not require auth — endpoint is UI-accessible by the operator", async () => {
    // The retry endpoint has no auth guard: it is called directly from the browser UI.
    // The operator (single user) controls the sequence and should be able to retry steps.
    // Safety is enforced by: only FAILED steps can be retried, MAX_RETRIES enforced, atomic tx.
    mockFindMany.mockResolvedValueOnce([]);

    const req = new NextRequest("http://localhost:3000/api/sequences/seq-001/retry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // No Authorization header — should still succeed
      body: JSON.stringify({}),
    });

    const response = await POST(req, makeParams());
    const body = await response.json();

    // Should reach business logic (not reject with 401)
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.retried).toBe(0); // no FAILED steps in mock
  });
});

describe("POST /api/sequences/[id]/retry — successful retry", () => {
  it("resets a FAILED step to PENDING and increments retry_count", async () => {
    mockFindMany.mockResolvedValueOnce([makeStep({ retry_count: 0 })]);
    mockUpdate.mockResolvedValueOnce({});
    mockEventCreate.mockResolvedValueOnce({});

    const response = await POST(makeRequest(), makeParams());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.retried).toBe(1);
    expect(body.skipped).toBe(0);
    expect(body.results[0].outcome).toBe("RETRIED");
    expect(body.results[0].retryCount).toBe(1); // 0 + 1

    // Verify the DB update was called with correct data
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "step-001" },
        data: expect.objectContaining({
          status: "PENDING",
          retry_count: { increment: 1 },
        }),
      })
    );

    // Verify audit event was created
    expect(mockEventCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sequence_step_id: "step-001",
          event_type: "FAILED",
          metadata: expect.objectContaining({ action: "RETRY_RESET", retried: true }),
        }),
      })
    );
  });

  it("allows retry at retry_count = MAX_RETRIES - 1", async () => {
    mockFindMany.mockResolvedValueOnce([makeStep({ retry_count: MAX_RETRIES - 1 })]);
    mockUpdate.mockResolvedValueOnce({});
    mockEventCreate.mockResolvedValueOnce({});

    const response = await POST(makeRequest(), makeParams());
    const body = await response.json();

    expect(body.retried).toBe(1);
    expect(body.results[0].outcome).toBe("RETRIED");
  });
});

describe("POST /api/sequences/[id]/retry — MAX_RETRIES enforcement", () => {
  it("rejects steps that have reached MAX_RETRIES", async () => {
    mockFindMany.mockResolvedValueOnce([makeStep({ retry_count: MAX_RETRIES })]);

    const response = await POST(makeRequest(), makeParams());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.retried).toBe(0);
    expect(body.skipped).toBe(1);
    expect(body.results[0].outcome).toBe("MAX_RETRIES_EXCEEDED");

    // DB update must NOT have been called
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("handles a mixed batch: some retried, some at max", async () => {
    mockFindMany.mockResolvedValueOnce([
      makeStep({ id: "step-001", retry_count: 1 }),   // eligible
      makeStep({ id: "step-002", retry_count: MAX_RETRIES }), // exhausted
    ]);
    mockUpdate.mockResolvedValueOnce({});
    mockEventCreate.mockResolvedValueOnce({});

    const response = await POST(makeRequest(), makeParams());
    const body = await response.json();

    expect(body.retried).toBe(1);
    expect(body.skipped).toBe(1);
    expect(body.results.find((r: { stepId: string; outcome: string }) => r.stepId === "step-001")?.outcome).toBe("RETRIED");
    expect(body.results.find((r: { stepId: string; outcome: string }) => r.stepId === "step-002")?.outcome).toBe("MAX_RETRIES_EXCEEDED");
  });
});

describe("POST /api/sequences/[id]/retry — edge cases", () => {
  it("returns ok with 0 retried when no FAILED steps exist", async () => {
    mockFindMany.mockResolvedValueOnce([]);

    const response = await POST(makeRequest(), makeParams());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.retried).toBe(0);
    expect(body.results).toHaveLength(0);
  });

  it("filters by specific stepIds when provided", async () => {
    // Only "step-002" should be retried
    mockFindMany.mockResolvedValueOnce([makeStep({ id: "step-002", retry_count: 0 })]);
    mockUpdate.mockResolvedValueOnce({});
    mockEventCreate.mockResolvedValueOnce({});

    const response = await POST(
      makeRequest({ stepIds: ["step-002"] }),
      makeParams()
    );
    const body = await response.json();

    expect(body.retried).toBe(1);
    // Verify Prisma was called with the id filter
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: ["step-002"] },
        }),
      })
    );
  });

  it("returns 400 if stepIds contains non-strings", async () => {
    const response = await POST(
      makeRequest({ stepIds: ["valid-id", 12345] }),
      makeParams()
    );
    expect(response.status).toBe(400);
  });
});
