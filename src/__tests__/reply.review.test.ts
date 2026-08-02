/**
 * Operator Review Queue & Action Tests — Phase 7
 *
 * Tests the human operator review workflow:
 *   - getPendingReviews()
 *   - processOperatorReviewAction()
 *     - CONFIRM_STOP delegates directly to atomic applyReplyStop() transaction
 *     - KEEP_ACTIVE sets review_status = CONFIRMED_KEEP_ACTIVE
 *     - DISMISS sets review_status = DISMISSED
 *   - Idempotency & error recovery
 */

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockApplyReplyStop = jest.fn();

jest.mock("@/lib/reply/stop", () => ({
  applyReplyStop: mockApplyReplyStop,
}));

const mockReplyFindMany = jest.fn();
const mockReplyFindUnique = jest.fn();
const mockReplyUpdate = jest.fn();

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    replyClassification: {
      findMany: mockReplyFindMany,
      findUnique: mockReplyFindUnique,
      update: mockReplyUpdate,
    },
  },
}));

import { getPendingReviews, processOperatorReviewAction } from "@/lib/reply/review";

beforeEach(() => {
  jest.clearAllMocks();
});

describe("getPendingReviews", () => {
  it("fetches review items matching NEEDS_REVIEW or PENDING status", async () => {
    mockReplyFindMany.mockResolvedValueOnce([
      {
        id: "rev-001",
        prospect_id: "p-001",
        gmail_thread_id: "thread-001",
        gmail_message_id: "msg-001",
        reply_type: "NEEDS_REVIEW",
        confidence: 0.85,
        reason: "PA reply",
        recommended_action: "STOP",
        signals: ["assistant"],
        review_status: "PENDING",
        raw_snippet: "John asked me to reply",
        classified_at: new Date("2026-07-27T10:00:00Z"),
        prospect: {
          id: "p-001",
          name: "John Doe",
          company: "Acme",
          email: "john@acme.com",
          sequence: { id: "seq-001", status: "ACTIVE" },
        },
      },
    ]);

    const items = await getPendingReviews();

    expect(items).toHaveLength(1);
    expect(items[0].prospectName).toBe("John Doe");
    expect(items[0].recommendedAction).toBe("STOP");
    expect(items[0].signals).toContain("assistant");
  });
});

describe("processOperatorReviewAction — CONFIRM_STOP", () => {
  it("executes atomic applyReplyStop transaction and updates review_status", async () => {
    mockReplyFindUnique.mockResolvedValueOnce({
      id: "rev-001",
      prospect_id: "p-001",
      gmail_thread_id: "thread-001",
      gmail_message_id: "msg-001",
      review_status: "PENDING",
      reason: "PA reply",
      raw_snippet: "John asked me to reply",
      prospect: {
        id: "p-001",
        sequence: { id: "seq-001", status: "ACTIVE" },
      },
    });

    mockApplyReplyStop.mockResolvedValueOnce({
      sequenceId: "seq-001",
      prospectId: "p-001",
      stepsCancelled: 2,
      stateUpdated: true,
      classificationRecorded: true,
    });

    mockReplyUpdate.mockResolvedValueOnce({});

    const result = await processOperatorReviewAction("rev-001", "CONFIRM_STOP");

    expect(result.ok).toBe(true);
    expect(result.action).toBe("CONFIRM_STOP");
    expect(result.stepsCancelled).toBe(2);
    expect(result.newReviewStatus).toBe("CONFIRMED_STOP");

    expect(mockApplyReplyStop).toHaveBeenCalledWith(
      "seq-001",
      "p-001",
      expect.objectContaining({
        gmailMessageId: "msg-001",
        gmailThreadId: "thread-001",
        replyType: "REAL_REPLY",
      })
    );

    expect(mockReplyUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "rev-001" },
        data: expect.objectContaining({
          review_status: "CONFIRMED_STOP",
        }),
      })
    );
  });
});

describe("processOperatorReviewAction — KEEP_ACTIVE", () => {
  it("updates review_status to CONFIRMED_KEEP_ACTIVE without calling stop logic", async () => {
    mockReplyFindUnique.mockResolvedValueOnce({
      id: "rev-002",
      prospect_id: "p-001",
      gmail_thread_id: "thread-001",
      gmail_message_id: "msg-002",
      review_status: "PENDING",
      prospect: {
        id: "p-001",
        sequence: { id: "seq-001", status: "ACTIVE" },
      },
    });

    mockReplyUpdate.mockResolvedValueOnce({});

    const result = await processOperatorReviewAction("rev-002", "KEEP_ACTIVE");

    expect(result.ok).toBe(true);
    expect(result.newReviewStatus).toBe("CONFIRMED_KEEP_ACTIVE");

    // applyReplyStop MUST NOT be called for KEEP_ACTIVE
    expect(mockApplyReplyStop).not.toHaveBeenCalled();

    expect(mockReplyUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "rev-002" },
        data: expect.objectContaining({
          review_status: "CONFIRMED_KEEP_ACTIVE",
        }),
      })
    );
  });
});

describe("processOperatorReviewAction — DISMISS", () => {
  it("updates review_status to DISMISSED", async () => {
    mockReplyFindUnique.mockResolvedValueOnce({
      id: "rev-003",
      prospect_id: "p-001",
      gmail_thread_id: "thread-001",
      gmail_message_id: "msg-003",
      review_status: "PENDING",
      prospect: {
        id: "p-001",
        sequence: { id: "seq-001", status: "ACTIVE" },
      },
    });

    mockReplyUpdate.mockResolvedValueOnce({});

    const result = await processOperatorReviewAction("rev-003", "DISMISS");

    expect(result.ok).toBe(true);
    expect(result.newReviewStatus).toBe("DISMISSED");
    expect(mockApplyReplyStop).not.toHaveBeenCalled();
  });
});

describe("processOperatorReviewAction — Idempotency", () => {
  it("returns early if review item was already processed", async () => {
    mockReplyFindUnique.mockResolvedValueOnce({
      id: "rev-already-done",
      review_status: "CONFIRMED_STOP",
      prospect: { prospect_id: "p-001" },
    });

    const result = await processOperatorReviewAction("rev-already-done", "CONFIRM_STOP");

    expect(result.ok).toBe(true);
    expect(result.newReviewStatus).toBe("CONFIRMED_STOP");
    expect(mockApplyReplyStop).not.toHaveBeenCalled();
    expect(mockReplyUpdate).not.toHaveBeenCalled();
  });
});
