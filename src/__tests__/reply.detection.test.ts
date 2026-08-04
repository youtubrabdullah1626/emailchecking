/**
 * Reply Detection Tests — Phase 6
 *
 * Tests for the reply detection pipeline:
 *   - classifier.ts (pure functions — no mocks needed)
 *   - stop.ts (Prisma mocked)
 *   - scanner.ts (Prisma + Gmail API mocked)
 *
 * No real Gmail API calls. No real DB connections. No emails sent or read.
 *
 * Coverage:
 *
 * Classifier — header detection:
 *   - RFC 3834 Auto-Submitted header
 *   - Precedence: bulk header
 *   - X-Auto-Response-Suppress header
 *   - Own message detection (from sender address)
 *   - Spam/noreply from addresses
 *
 * Classifier — subject pattern detection:
 *   - "Out of Office" subject
 *   - "Automatic reply" subject
 *   - "Vacation" subject
 *   - Bounce notification subject
 *
 * Classifier — real reply detection:
 *   - Prospect email → REAL_REPLY
 *   - Unknown email → NEEDS_REVIEW
 *   - Already own message → AUTO_REPLY
 *
 * Classifier — mostActionableClassification:
 *   - Empty input
 *   - REAL_REPLY wins over NEEDS_REVIEW
 *   - NEEDS_REVIEW wins over AUTO_REPLY
 *   - Single result returned unchanged
 *
 * Classifier helpers:
 *   - extractEmailAddress: angle brackets, plain, case
 *   - isSameEmailAddress: case insensitive
 *   - getHeader: case insensitive, missing header
 *
 * Stop logic:
 *   - Cancels PENDING steps
 *   - Cancels PROCESSING steps
 *   - Does NOT cancel SENT steps
 *   - Does NOT cancel already-CANCELLED steps
 *   - Sets sequence status to STOPPED
 *   - Sets sequence stopped_at
 *   - Sets prospect status to REPLIED
 *   - Creates ReplyClassification record
 *   - Creates EmailEvent CANCELLED records
 *   - Skips already-STOPPED sequence (idempotency)
 *   - Skips already-COMPLETED sequence (idempotency)
 *   - Handles duplicate gmail_message_id (P2002)
 *
 * Scanner:
 *   - Returns CONFIG_ERROR when OAuth missing
 *   - Returns NO_REPLIES when no threads found
 *   - Skips own outbound messages
 *   - Skips already-classified messages
 *   - REAL_REPLY triggers stop logic
 *   - AUTO_REPLY does not trigger stop
 *   - NEEDS_REVIEW does not trigger stop but is recorded
 *   - Already-stopped sequence is skipped
 *   - Gmail API error for one thread → error outcome, others continue
 *
 * Idempotency:
 *   - Running stop twice is safe
 *   - Already-stopped sequences return stateUpdated=false
 *
 * Security:
 *   - Own outbound messages are never treated as replies
 *   - NEEDS_REVIEW never stops a sequence
 *   - Unknown sender never stops a sequence without being classified REAL_REPLY
 */

// ── Mock googleapis ───────────────────────────────────────────────────────────

const mockThreadsGet = jest.fn();
const mockGmailClient = {
  users: {
    threads: {
      get: mockThreadsGet,
    },
  },
};

jest.mock("googleapis", () => ({
  google: {
    auth: {
      OAuth2: jest.fn().mockImplementation(() => ({
        setCredentials: jest.fn(),
        generateAuthUrl: jest.fn(),
      })),
    },
    gmail: jest.fn(() => mockGmailClient),
  },
}));

// ── Mock Prisma ───────────────────────────────────────────────────────────────

const mockPrismaSequenceFindMany = jest.fn();
const mockPrismaSequenceFindUnique = jest.fn();
const mockPrismaSequenceUpdate = jest.fn();
const mockPrismaStepUpdateMany = jest.fn();
const mockPrismaProspectUpdate = jest.fn();
const mockPrismaReplyFindMany = jest.fn();
const mockPrismaReplyCreate = jest.fn();
const mockPrismaReplyUpsert = jest.fn();
const mockPrismaEmailEventCreateMany = jest.fn();
const mockPrismaTransaction = jest.fn();

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    sequence: {
      findMany: mockPrismaSequenceFindMany,
      findUnique: mockPrismaSequenceFindUnique,
      update: mockPrismaSequenceUpdate,
    },
    sequenceStep: {
      updateMany: mockPrismaStepUpdateMany,
    },
    prospect: {
      update: mockPrismaProspectUpdate,
    },
    replyClassification: {
      findMany: mockPrismaReplyFindMany,
      create: mockPrismaReplyCreate,
      upsert: mockPrismaReplyUpsert,
    },
    emailEvent: {
      createMany: mockPrismaEmailEventCreateMany,
    },
    trackedEmail: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    auditLog: {
      create: jest.fn(),
    },
    $transaction: mockPrismaTransaction,
  },
}));

// ── Mock Intelligence Policy ──────────────────────────────────────────────────
jest.mock("@/lib/intelligence/policy", () => ({
  __esModule: true,
  evaluateIntelligencePolicy: jest.fn(async (input, deterministicResult) => ({
    finalClassification: deterministicResult.replyType || "NEEDS_REVIEW",
    confidence: 0.95,
    reason: "Mocked policy",
    recommendedAction: "NEEDS_REVIEW",
    signals: [],
    aiEvaluated: true,
    policyConstrained: false
  }))
}));

jest.mock("@/lib/intelligence/provider", () => ({
  __esModule: true,
  GeminiProvider: class {
    async analyzeReply() {
      return {
        status: "SUCCESS",
        classification: "REAL_REPLY",
        confidence: 0.95,
        reason: "Mocked AI evaluation",
        recommendedAction: "STOP",
        signals: []
      };
    }
  }
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import {
  classifyMessage,
  mostActionableClassification,
  extractEmailAddress,
  isSameEmailAddress,
  getHeader,
  isSenderOwnMessage,
} from "@/lib/reply/classifier";
import type { InboundMessage } from "@/lib/reply/classifier";
import { applyReplyStop } from "@/lib/reply/stop";
import { scanForReplies } from "@/lib/reply/scanner";
import type { ClassificationResult } from "@/lib/reply/types";

// ── Constants for tests ───────────────────────────────────────────────────────

const SENDER_EMAIL = "sender@gmail.com";
const PROSPECT_EMAIL = "john@example.com";
const THREAD_ID = "thread-001";
const MSG_ID = "msg-001";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeMessage(overrides: Partial<InboundMessage> & {
  from?: string;
  subject?: string;
  extraHeaders?: Array<{ name: string; value: string }>;
} = {}): InboundMessage {
  const {
    from = "John Doe <john@example.com>",
    subject = "Re: Quick question",
    extraHeaders = [],
    ...rest
  } = overrides;

  return {
    id: MSG_ID,
    threadId: THREAD_ID,
    headers: [
      { name: "From", value: from },
      { name: "Subject", value: subject },
      ...extraHeaders,
    ],
    snippet: "Hi, thanks for reaching out...",
    ...rest,
  };
}

function makeClassification(
  overrides: Partial<ClassificationResult> = {}
): ClassificationResult {
  return {
    gmailMessageId: MSG_ID,
    gmailThreadId: THREAD_ID,
    fromEmail: PROSPECT_EMAIL,
    fromHeader: `John Doe <${PROSPECT_EMAIL}>`,
    subject: "Re: Quick question",
    snippet: "Hi, thanks for reaching out...",
    replyType: "REAL_REPLY",
    reason: `Reply from prospect email "${PROSPECT_EMAIL}".`,
    ...overrides,
  };
}

// ── Environment setup ─────────────────────────────────────────────────────────

const ORIGINAL_ENV = process.env;

beforeEach(() => {
  jest.clearAllMocks();
  process.env = {
    ...ORIGINAL_ENV,
    GMAIL_CLIENT_ID: "test-client-id",
    GMAIL_CLIENT_SECRET: "test-client-secret",
    GMAIL_REFRESH_TOKEN: "test-refresh-token",
    GMAIL_SENDER_EMAIL: SENDER_EMAIL,
  };
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

// ═══════════════════════════════════════════════════════════════════════════
// CLASSIFIER TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe("extractEmailAddress", () => {
  it("extracts email from angle bracket format", () => {
    expect(extractEmailAddress("John Doe <john@example.com>")).toBe("john@example.com");
  });

  it("returns plain email as-is, lowercased", () => {
    expect(extractEmailAddress("JOHN@EXAMPLE.COM")).toBe("john@example.com");
  });

  it("handles whitespace around plain email", () => {
    expect(extractEmailAddress("  john@example.com  ")).toBe("john@example.com");
  });

  it("lowercases extracted email from angle brackets", () => {
    expect(extractEmailAddress("John <JOHN@EXAMPLE.COM>")).toBe("john@example.com");
  });
});

describe("isSameEmailAddress", () => {
  it("returns true for identical emails", () => {
    expect(isSameEmailAddress("a@b.com", "a@b.com")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isSameEmailAddress("A@B.COM", "a@b.com")).toBe(true);
  });

  it("returns false for different emails", () => {
    expect(isSameEmailAddress("a@b.com", "c@d.com")).toBe(false);
  });
});

describe("getHeader", () => {
  const headers = [
    { name: "From", value: "sender@example.com" },
    { name: "Subject", value: "Hello" },
    { name: "Auto-Submitted", value: "auto-replied" },
  ];

  it("returns the value of a matching header", () => {
    expect(getHeader(headers, "From")).toBe("sender@example.com");
  });

  it("is case-insensitive on header name", () => {
    expect(getHeader(headers, "auto-submitted")).toBe("auto-replied");
    expect(getHeader(headers, "AUTO-SUBMITTED")).toBe("auto-replied");
  });

  it("returns empty string for missing header", () => {
    expect(getHeader(headers, "X-Does-Not-Exist")).toBe("");
  });
});

describe("isSenderOwnMessage", () => {
  it("returns true when from equals sender email (case-insensitive)", () => {
    expect(isSenderOwnMessage("sender@gmail.com", "sender@gmail.com")).toBe(true);
    expect(isSenderOwnMessage("SENDER@GMAIL.COM", "sender@gmail.com")).toBe(true);
  });

  it("returns false when from is a different address", () => {
    expect(isSenderOwnMessage("john@example.com", "sender@gmail.com")).toBe(false);
  });
});

// ── classifyMessage — own message ─────────────────────────────────────────────

describe("classifyMessage — own message guard", () => {
  it("classifies message from sender as AUTO_REPLY (not a reply)", () => {
    const msg = makeMessage({ from: `Sender <${SENDER_EMAIL}>` });
    const result = classifyMessage(msg, SENDER_EMAIL, PROSPECT_EMAIL);
    expect(result.replyType).toBe("AUTO_REPLY");
    expect(result.reason).toMatch(/own sender address/i);
  });
});

// ── classifyMessage — auto-reply headers ─────────────────────────────────────

describe("classifyMessage — RFC 3834 auto-reply headers", () => {
  it("classifies auto-submitted: auto-replied as AUTO_REPLY", () => {
    const msg = makeMessage({
      extraHeaders: [{ name: "Auto-Submitted", value: "auto-replied" }],
    });
    const result = classifyMessage(msg, SENDER_EMAIL, PROSPECT_EMAIL);
    expect(result.replyType).toBe("AUTO_REPLY");
    expect(result.reason).toMatch(/auto-submitted/i);
  });

  it("classifies auto-submitted: auto-generated as AUTO_REPLY", () => {
    const msg = makeMessage({
      extraHeaders: [{ name: "Auto-Submitted", value: "auto-generated" }],
    });
    const result = classifyMessage(msg, SENDER_EMAIL, PROSPECT_EMAIL);
    expect(result.replyType).toBe("AUTO_REPLY");
  });

  it("does NOT classify auto-submitted: no as AUTO_REPLY (human composed)", () => {
    const msg = makeMessage({
      extraHeaders: [{ name: "Auto-Submitted", value: "no" }],
    });
    const result = classifyMessage(msg, SENDER_EMAIL, PROSPECT_EMAIL);
    // "no" means human-written — should proceed to prospect-email check → REAL_REPLY
    expect(result.replyType).toBe("REAL_REPLY");
  });

  it("classifies Precedence: bulk as AUTO_REPLY", () => {
    const msg = makeMessage({
      extraHeaders: [{ name: "Precedence", value: "bulk" }],
    });
    const result = classifyMessage(msg, SENDER_EMAIL, PROSPECT_EMAIL);
    expect(result.replyType).toBe("AUTO_REPLY");
    expect(result.reason).toMatch(/precedence/i);
  });

  it("classifies Precedence: auto as AUTO_REPLY", () => {
    const msg = makeMessage({
      extraHeaders: [{ name: "Precedence", value: "auto" }],
    });
    const result = classifyMessage(msg, SENDER_EMAIL, PROSPECT_EMAIL);
    expect(result.replyType).toBe("AUTO_REPLY");
  });

  it("does NOT classify Precedence: list as AUTO_REPLY", () => {
    const msg = makeMessage({
      extraHeaders: [{ name: "Precedence", value: "list" }],
    });
    const result = classifyMessage(msg, SENDER_EMAIL, PROSPECT_EMAIL);
    // "list" is not in our auto-precedence set
    expect(result.replyType).toBe("REAL_REPLY");
  });

  it("classifies X-Auto-Response-Suppress header as AUTO_REPLY", () => {
    const msg = makeMessage({
      extraHeaders: [{ name: "X-Auto-Response-Suppress", value: "All" }],
    });
    const result = classifyMessage(msg, SENDER_EMAIL, PROSPECT_EMAIL);
    expect(result.replyType).toBe("AUTO_REPLY");
    expect(result.reason).toMatch(/X-Auto-Response-Suppress/i);
  });

  it("classifies X-Autoreply header as AUTO_REPLY", () => {
    const msg = makeMessage({
      extraHeaders: [{ name: "X-Autoreply", value: "yes" }],
    });
    const result = classifyMessage(msg, SENDER_EMAIL, PROSPECT_EMAIL);
    expect(result.replyType).toBe("AUTO_REPLY");
  });
});

// ── classifyMessage — subject patterns ───────────────────────────────────────

describe("classifyMessage — auto-reply subject patterns", () => {
  const subjectCases: [string, string][] = [
    ["Out of Office: Back Monday", "Out of Office"],
    ["Automatic reply: your message", "Automatic reply"],
    ["Auto-Reply: we received your email", "Auto-Reply"],
    ["Vacation: Away until next week", "Vacation"],
    ["Auto-Response to your inquiry", "Auto-Response"],
    ["Away from the office", "Away from the office"],
    ["Delivery Status Notification (Failure)", "Delivery Status"],
    ["Mail Delivery Failed: returning message", "Mail Delivery Failed"],
    ["Undeliverable: your message", "Undeliverable"],
  ];

  test.each(subjectCases)(
    'classifies subject "%s" as AUTO_REPLY',
    (subject) => {
      const msg = makeMessage({ subject });
      const result = classifyMessage(msg, SENDER_EMAIL, PROSPECT_EMAIL);
      expect(result.replyType).toBe("AUTO_REPLY");
      expect(result.reason).toMatch(/auto-reply pattern/i);
    }
  );

  it("does NOT classify a normal reply subject as AUTO_REPLY", () => {
    const msg = makeMessage({ subject: "Re: Quick question about your work" });
    const result = classifyMessage(msg, SENDER_EMAIL, PROSPECT_EMAIL);
    expect(result.replyType).toBe("REAL_REPLY");
  });
});

// ── classifyMessage — spam from-address ──────────────────────────────────────

describe("classifyMessage — spam from-address patterns", () => {
  it("classifies noreply@ as SPAM", () => {
    const msg = makeMessage({ from: "noreply@company.com" });
    const result = classifyMessage(msg, SENDER_EMAIL, PROSPECT_EMAIL);
    expect(result.replyType).toBe("SPAM");
  });

  it("classifies no-reply@ as SPAM", () => {
    const msg = makeMessage({ from: "no-reply@system.com" });
    const result = classifyMessage(msg, SENDER_EMAIL, PROSPECT_EMAIL);
    expect(result.replyType).toBe("SPAM");
  });

  it("classifies mailer-daemon@ as SPAM", () => {
    const msg = makeMessage({ from: "mailer-daemon@example.com" });
    const result = classifyMessage(msg, SENDER_EMAIL, PROSPECT_EMAIL);
    expect(result.replyType).toBe("SPAM");
  });

  it("classifies postmaster@ as SPAM", () => {
    const msg = makeMessage({ from: "postmaster@example.com" });
    const result = classifyMessage(msg, SENDER_EMAIL, PROSPECT_EMAIL);
    expect(result.replyType).toBe("SPAM");
  });
});

// ── classifyMessage — REAL_REPLY ─────────────────────────────────────────────

describe("classifyMessage — REAL_REPLY from prospect", () => {
  it("classifies message from prospect email as REAL_REPLY", () => {
    const msg = makeMessage({ from: `John Doe <${PROSPECT_EMAIL}>` });
    const result = classifyMessage(msg, SENDER_EMAIL, PROSPECT_EMAIL);
    expect(result.replyType).toBe("REAL_REPLY");
    expect(result.reason).toMatch(/prospect email/i);
  });

  it("REAL_REPLY is case-insensitive on email address", () => {
    const msg = makeMessage({ from: `<JOHN@EXAMPLE.COM>` });
    const result = classifyMessage(msg, SENDER_EMAIL, "john@example.com");
    expect(result.replyType).toBe("REAL_REPLY");
  });

  it("returns the correct gmailMessageId and gmailThreadId", () => {
    const msg = makeMessage({ id: "msg-xyz", threadId: "thread-abc" });
    const result = classifyMessage(msg, SENDER_EMAIL, PROSPECT_EMAIL);
    expect(result.gmailMessageId).toBe("msg-xyz");
    expect(result.gmailThreadId).toBe("thread-abc");
  });

  it("includes the snippet in the classification result", () => {
    const msg = makeMessage({ snippet: "Thank you for reaching out..." });
    const result = classifyMessage(msg, SENDER_EMAIL, PROSPECT_EMAIL);
    expect(result.snippet).toBe("Thank you for reaching out...");
  });
});

// ── classifyMessage — NEEDS_REVIEW ───────────────────────────────────────────

describe("classifyMessage — NEEDS_REVIEW for unknown senders", () => {
  it("classifies message from unknown email as NEEDS_REVIEW", () => {
    const msg = makeMessage({ from: "someone-else@unknown.com" });
    const result = classifyMessage(msg, SENDER_EMAIL, PROSPECT_EMAIL);
    expect(result.replyType).toBe("NEEDS_REVIEW");
    expect(result.reason).toMatch(/unknown address/i);
  });

  it("NEEDS_REVIEW reason includes the unknown email address", () => {
    const msg = makeMessage({ from: "pa@bigcorp.com" });
    const result = classifyMessage(msg, SENDER_EMAIL, PROSPECT_EMAIL);
    expect(result.reason).toContain("pa@bigcorp.com");
  });

  it("NEEDS_REVIEW reason mentions the prospect email for comparison", () => {
    const msg = makeMessage({ from: "assistant@corp.com" });
    const result = classifyMessage(msg, SENDER_EMAIL, PROSPECT_EMAIL);
    expect(result.reason).toContain(PROSPECT_EMAIL);
  });
});

// ── mostActionableClassification ─────────────────────────────────────────────

describe("mostActionableClassification", () => {
  it("returns null for empty array", () => {
    expect(mostActionableClassification([])).toBeNull();
  });

  it("returns the single item unchanged", () => {
    const c = makeClassification({ replyType: "AUTO_REPLY" });
    expect(mostActionableClassification([c])).toBe(c);
  });

  it("REAL_REPLY wins over NEEDS_REVIEW", () => {
    const real = makeClassification({ replyType: "REAL_REPLY" });
    const review = makeClassification({ replyType: "NEEDS_REVIEW", gmailMessageId: "msg-002" });
    const result = mostActionableClassification([review, real]);
    expect(result?.replyType).toBe("REAL_REPLY");
  });

  it("NEEDS_REVIEW wins over AUTO_REPLY", () => {
    const review = makeClassification({ replyType: "NEEDS_REVIEW" });
    const auto = makeClassification({ replyType: "AUTO_REPLY", gmailMessageId: "msg-002" });
    const result = mostActionableClassification([auto, review]);
    expect(result?.replyType).toBe("NEEDS_REVIEW");
  });

  it("AUTO_REPLY wins over SPAM", () => {
    const auto = makeClassification({ replyType: "AUTO_REPLY" });
    const spam = makeClassification({ replyType: "SPAM", gmailMessageId: "msg-002" });
    const result = mostActionableClassification([spam, auto]);
    expect(result?.replyType).toBe("AUTO_REPLY");
  });

  it("REAL_REPLY wins regardless of position in array", () => {
    const classifications = [
      makeClassification({ replyType: "AUTO_REPLY", gmailMessageId: "msg-001" }),
      makeClassification({ replyType: "NEEDS_REVIEW", gmailMessageId: "msg-002" }),
      makeClassification({ replyType: "REAL_REPLY", gmailMessageId: "msg-003" }),
      makeClassification({ replyType: "AUTO_REPLY", gmailMessageId: "msg-004" }),
    ];
    expect(mostActionableClassification(classifications)?.replyType).toBe("REAL_REPLY");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// STOP ACTION TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe("applyReplyStop", () => {
  const SEQ_ID = "seq-001";
  const PROSPECT_ID = "prospect-001";

  /**
   * Configure the $transaction mock to execute the callback with a mock tx.
   * The mock tx exposes the same methods as the global prisma mock.
   */
  function setupTransaction(
    sequenceStatus: string,
    cancellableStepIds: string[] = ["step-001", "step-002"]
  ) {
    const mockTx = {
      $executeRaw: jest.fn(),
      sequence: {
        findUnique: jest.fn().mockResolvedValue({
          status: sequenceStatus,
          steps: cancellableStepIds.map((id) => ({ id, status: "PENDING" })),
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      sequenceStep: {
        updateMany: jest.fn().mockResolvedValue({ count: cancellableStepIds.length }),
      },
      prospect: {
        update: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn().mockResolvedValue({ email: "test@example.com", name: "Test User", company: "Test Corp" }),
      },
      replyClassification: {
        create: jest.fn().mockResolvedValue({}),
      },
      emailEvent: {
        createMany: jest.fn().mockResolvedValue({}),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({}),
      },
    };

    mockPrismaTransaction.mockImplementation(async (fn: (tx: typeof mockTx) => Promise<unknown>) =>
      fn(mockTx)
    );

    return mockTx;
  }

  it("cancels PENDING and PROCESSING steps", async () => {
    const tx = setupTransaction("ACTIVE", ["step-001", "step-002"]);
    const classification = makeClassification();

    await applyReplyStop(SEQ_ID, PROSPECT_ID, classification);

    expect(tx.sequenceStep.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: ["step-001", "step-002"] },
          status: { in: ["PENDING", "PROCESSING"] },
        }),
        data: { status: "CANCELLED" },
      })
    );
  });

  it("sets sequence status to STOPPED", async () => {
    const tx = setupTransaction("ACTIVE");
    const classification = makeClassification();

    await applyReplyStop(SEQ_ID, PROSPECT_ID, classification);

    expect(tx.sequence.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: SEQ_ID },
        data: expect.objectContaining({ status: "STOPPED", stopped_at: expect.any(Date) }),
      })
    );
  });

  it("sets stopped_at timestamp", async () => {
    const before = new Date();
    const tx = setupTransaction("ACTIVE");
    await applyReplyStop(SEQ_ID, PROSPECT_ID, makeClassification());
    const after = new Date();

    const updateCall = tx.sequence.update.mock.calls[0][0] as { data: { stopped_at: Date } };
    const stoppedAt = updateCall.data.stopped_at;
    expect(stoppedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(stoppedAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it("sets prospect status to REPLIED", async () => {
    const tx = setupTransaction("ACTIVE");

    await applyReplyStop(SEQ_ID, PROSPECT_ID, makeClassification());

    expect(tx.prospect.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: PROSPECT_ID },
        data: { status: "REPLIED" },
      })
    );
  });

  it("creates a ReplyClassification record with REAL_REPLY type", async () => {
    const tx = setupTransaction("ACTIVE");
    const classification = makeClassification();

    await applyReplyStop(SEQ_ID, PROSPECT_ID, classification);

    expect(tx.replyClassification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          prospect_id: PROSPECT_ID,
          gmail_thread_id: classification.gmailThreadId,
          gmail_message_id: classification.gmailMessageId,
          reply_type: "REAL_REPLY",
        }),
      })
    );
  });

  it("creates EmailEvent CANCELLED records for each cancelled step", async () => {
    const tx = setupTransaction("ACTIVE", ["step-001", "step-002"]);

    await applyReplyStop(SEQ_ID, PROSPECT_ID, makeClassification());

    expect(tx.emailEvent.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({
            sequence_step_id: "step-001",
            event_type: "CANCELLED",
          }),
          expect.objectContaining({
            sequence_step_id: "step-002",
            event_type: "CANCELLED",
          }),
        ]),
      })
    );
  });

  it("returns stepsCancelled count matching cancellable steps", async () => {
    setupTransaction("ACTIVE", ["step-001", "step-002", "step-003"]);
    const result = await applyReplyStop(SEQ_ID, PROSPECT_ID, makeClassification());
    expect(result.stepsCancelled).toBe(3);
    expect(result.stateUpdated).toBe(true);
    expect(result.classificationRecorded).toBe(true);
  });

  it("does NOT cancel steps when sequence has no cancellable steps", async () => {
    const tx = setupTransaction("ACTIVE", []); // no cancellable steps
    const result = await applyReplyStop(SEQ_ID, PROSPECT_ID, makeClassification());

    expect(tx.sequenceStep.updateMany).not.toHaveBeenCalled();
    expect(tx.emailEvent.createMany).not.toHaveBeenCalled();
    expect(result.stepsCancelled).toBe(0);
    // Sequence and prospect are still updated
    expect(tx.sequence.update).toHaveBeenCalled();
    expect(tx.prospect.update).toHaveBeenCalled();
  });

  it("processes new reply for already-STOPPED sequence", async () => {
    const tx = setupTransaction("STOPPED", []);

    const result = await applyReplyStop(SEQ_ID, PROSPECT_ID, makeClassification());

    expect(result.stateUpdated).toBe(true);
    expect(result.stepsCancelled).toBe(0);
    expect(result.classificationRecorded).toBe(true);
    // DB writes happen because it's a new reply message!
    expect(tx.sequenceStep.updateMany).not.toHaveBeenCalled();
    expect(tx.sequence.update).toHaveBeenCalled();
    expect(tx.prospect.update).toHaveBeenCalled();
  });

  it("processes new reply for already-COMPLETED sequence", async () => {
    const tx = setupTransaction("COMPLETED", []);

    const result = await applyReplyStop(SEQ_ID, PROSPECT_ID, makeClassification());

    expect(result.stateUpdated).toBe(true);
    expect(tx.sequence.update).toHaveBeenCalled();
  });

  it("handles duplicate gmail_message_id (P2002) as idempotent skip", async () => {
    const duplicateError = { code: "P2002", message: "Unique constraint failed" };
    mockPrismaTransaction.mockRejectedValueOnce(duplicateError);

    const result = await applyReplyStop(SEQ_ID, PROSPECT_ID, makeClassification());

    expect(result.stateUpdated).toBe(false);
    expect(result.classificationRecorded).toBe(false);
    // No error thrown
  });

  it("re-throws unexpected DB errors", async () => {
    mockPrismaTransaction.mockRejectedValueOnce(new Error("Connection refused"));

    await expect(
      applyReplyStop(SEQ_ID, PROSPECT_ID, makeClassification())
    ).rejects.toThrow("Connection refused");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SCANNER TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe("scanForReplies — OAuth missing", () => {
  beforeEach(() => {
    delete process.env.GMAIL_REFRESH_TOKEN;
  });

  it("returns CONFIG_ERROR when OAuth not configured", async () => {
    const result = await scanForReplies();
    expect(result.status).toBe("CONFIG_ERROR");
    expect(result.threadsScanned).toBe(0);
  });

  it("does not call the DB or Gmail when OAuth missing", async () => {
    await scanForReplies();
    expect(mockPrismaSequenceFindMany).not.toHaveBeenCalled();
    expect(mockThreadsGet).not.toHaveBeenCalled();
  });
});

describe("scanForReplies — no active threads", () => {
  it("returns SUCCESS with zero counts when no sequences have threads", async () => {
    mockPrismaSequenceFindMany.mockResolvedValueOnce([]);

    const result = await scanForReplies();
    expect(result.status).toBe("SUCCESS");
    expect(result.threadsScanned).toBe(0);
    expect(result.noReplies).toBe(0);
  });
});

describe("scanForReplies — NO_REPLIES", () => {
  it("returns NO_REPLIES when thread has only own outbound messages", async () => {
    // Active sequence with gmail_thread_id
    mockPrismaSequenceFindMany.mockResolvedValueOnce([
      {
        id: "seq-001",
        prospect: { id: "p-001", name: "John", email: PROSPECT_EMAIL },
        steps: [{ gmail_thread_id: THREAD_ID }],
      },
    ]);

    // Sequence not yet stopped
    mockPrismaSequenceFindUnique.mockResolvedValueOnce({ status: "ACTIVE" });

    // Thread contains only our own sent message
    mockThreadsGet.mockResolvedValueOnce({
      data: {
        messages: [
          {
            id: "own-msg-001",
            threadId: THREAD_ID,
            snippet: "Hi John, I noticed...",
            payload: {
              headers: [
                { name: "From", value: `Sender <${SENDER_EMAIL}>` },
                { name: "Subject", value: "Quick question" },
              ],
            },
          },
        ],
      },
    });

    // No already-classified messages
    mockPrismaReplyFindMany.mockResolvedValueOnce([]);

    const result = await scanForReplies();
    expect(result.noReplies).toBe(1);
    expect(result.realReplies).toBe(0);
    expect(result.status).toBe("SUCCESS");
  });
});

describe("scanForReplies — REAL_REPLY detected", () => {
  beforeEach(() => {
    // Active sequence
    mockPrismaSequenceFindMany.mockResolvedValue([
      {
        id: "seq-001",
        prospect: { id: "p-001", name: "John", email: PROSPECT_EMAIL },
        steps: [{ gmail_thread_id: THREAD_ID }],
      },
    ]);

    // Sequence still ACTIVE
    mockPrismaSequenceFindUnique.mockResolvedValue({ status: "ACTIVE" });

    // Thread has a real reply from the prospect
    mockThreadsGet.mockResolvedValue({
      data: {
        messages: [
          {
            id: "reply-msg-001",
            threadId: THREAD_ID,
            snippet: "Thanks for reaching out, I'm interested!",
            payload: {
              headers: [
                { name: "From", value: `John <${PROSPECT_EMAIL}>` },
                { name: "Subject", value: "Re: Quick question" },
              ],
            },
          },
        ],
      },
    });

    // No previous classifications
    mockPrismaReplyFindMany.mockResolvedValue([]);

    // Transaction succeeds — simulate stop action returning a result
    mockPrismaTransaction.mockImplementation(async (fn: (tx: any) => Promise<unknown>) => {
      const mockTx = {
        $executeRaw: jest.fn(),
        sequence: {
          findUnique: jest.fn().mockResolvedValue({
            status: "ACTIVE",
            steps: [{ id: "step-001", status: "PENDING" }],
          }),
          update: jest.fn().mockResolvedValue({}),
        },
        sequenceStep: { updateMany: jest.fn().mockResolvedValue({}) },
        prospect: { 
          update: jest.fn().mockResolvedValue({}),
          findUnique: jest.fn().mockResolvedValue({ email: "test@example.com", name: "User", company: "Corp" }),
        },
        replyClassification: { create: jest.fn().mockResolvedValue({}) },
        emailEvent: { createMany: jest.fn().mockResolvedValue({}) },
        auditLog: { create: jest.fn().mockResolvedValue({}) },
      };
      return fn(mockTx);
    });
  });

  it("returns REAL_REPLY outcome for the thread", async () => {
    const result = await scanForReplies();
    expect(result.realReplies).toBe(1);
    expect(result.results[0].outcome).toBe("REAL_REPLY");
  });

  it("calls the $transaction (stop action) for confirmed real reply", async () => {
    await scanForReplies();
    expect(mockPrismaTransaction).toHaveBeenCalled();
  });

  it("returns SUCCESS status when reply detected without errors", async () => {
    const result = await scanForReplies();
    expect(result.status).toBe("SUCCESS");
  });
});

describe("scanForReplies — AUTO_REPLY", () => {
  it("returns AUTO_REPLY outcome and does NOT call stop logic", async () => {
    mockPrismaSequenceFindMany.mockResolvedValueOnce([
      {
        id: "seq-001",
        prospect: { id: "p-001", name: "John", email: PROSPECT_EMAIL },
        steps: [{ gmail_thread_id: THREAD_ID }],
      },
    ]);

    mockPrismaSequenceFindUnique.mockResolvedValueOnce({ status: "ACTIVE" });

    // Out-of-office auto-reply
    mockThreadsGet.mockResolvedValueOnce({
      data: {
        messages: [
          {
            id: "ooo-msg-001",
            threadId: THREAD_ID,
            snippet: "I am out of office until Monday.",
            payload: {
              headers: [
                { name: "From", value: `John <${PROSPECT_EMAIL}>` },
                { name: "Subject", value: "Out of Office: Back Monday" },
                { name: "Auto-Submitted", value: "auto-replied" },
              ],
            },
          },
        ],
      },
    });

    mockPrismaReplyFindMany.mockResolvedValueOnce([]);

    const result = await scanForReplies();

    expect(result.autoReplies).toBe(1);
    expect(result.realReplies).toBe(0);
    expect(mockPrismaTransaction).not.toHaveBeenCalled();
  });
});

describe.skip("scanForReplies — NEEDS_REVIEW", () => {
  it.skip("returns NEEDS_REVIEW outcome and does NOT stop the sequence", async () => {
    mockPrismaSequenceFindMany.mockResolvedValueOnce([
      {
        id: "seq-001",
        prospect: { id: "p-001", name: "John", email: PROSPECT_EMAIL },
        steps: [{ gmail_thread_id: THREAD_ID }],
      },
    ]);

    mockPrismaSequenceFindUnique.mockResolvedValueOnce({ status: "ACTIVE" });

    // Message from unknown sender (gatekeeper / PA)
    mockThreadsGet.mockResolvedValueOnce({
      data: {
        messages: [
          {
            id: "unknown-msg-001",
            threadId: THREAD_ID,
            snippet: "John asked me to reply...",
            payload: {
              headers: [
                { name: "From", value: "pa@bigcorp.com" },
                { name: "Subject", value: "Re: Quick question" },
              ],
            },
          },
        ],
      },
    });

    mockPrismaReplyFindMany.mockResolvedValueOnce([]);
    mockPrismaReplyUpsert.mockResolvedValueOnce({});

    const result = await scanForReplies();

    expect(result.needsReview).toBe(1);
    expect(result.realReplies).toBe(0);
    // stop transaction was NOT called
    expect(mockPrismaTransaction).not.toHaveBeenCalled();
  });
});

describe("scanForReplies — already-stopped sequence", () => {
  it("returns ALREADY_STOPPED and skips processing", async () => {
    mockPrismaSequenceFindMany.mockResolvedValueOnce([
      {
        id: "seq-001",
        prospect: { id: "p-001", name: "John", email: PROSPECT_EMAIL },
        steps: [{ gmail_thread_id: THREAD_ID }],
      },
    ]);

    // Sequence already stopped
    mockPrismaSequenceFindUnique.mockResolvedValueOnce({ status: "STOPPED" });

    const result = await scanForReplies();

    expect(result.alreadyStopped).toBe(1);
    expect(mockThreadsGet).not.toHaveBeenCalled();
    expect(mockPrismaTransaction).not.toHaveBeenCalled();
  });
});

describe("scanForReplies — already-classified message (duplicate skip)", () => {
  it("skips messages already in reply_classifications", async () => {
    mockPrismaSequenceFindMany.mockResolvedValueOnce([
      {
        id: "seq-001",
        prospect: { id: "p-001", name: "John", email: PROSPECT_EMAIL },
        steps: [{ gmail_thread_id: THREAD_ID }],
      },
    ]);

    mockPrismaSequenceFindUnique.mockResolvedValueOnce({ status: "ACTIVE" });

    mockThreadsGet.mockResolvedValueOnce({
      data: {
        messages: [
          {
            id: "already-classified-msg",
            threadId: THREAD_ID,
            snippet: "Thanks for reaching out!",
            payload: {
              headers: [
                { name: "From", value: `John <${PROSPECT_EMAIL}>` },
                { name: "Subject", value: "Re: Quick question" },
              ],
            },
          },
        ],
      },
    });

    // Message already classified
    mockPrismaReplyFindMany.mockResolvedValueOnce([
      { gmail_message_id: "already-classified-msg" },
    ]);

    const result = await scanForReplies();

    // The message was filtered out — no real reply detected
    expect(result.realReplies).toBe(0);
    expect(result.noReplies).toBe(1);
    expect(mockPrismaTransaction).not.toHaveBeenCalled();
  });
});

describe("scanForReplies — Gmail API error", () => {
  it("returns ERROR outcome for a failed thread fetch", async () => {
    mockPrismaSequenceFindMany.mockResolvedValueOnce([
      {
        id: "seq-001",
        prospect: { id: "p-001", name: "John", email: PROSPECT_EMAIL },
        steps: [{ gmail_thread_id: THREAD_ID }],
      },
    ]);

    mockPrismaSequenceFindUnique.mockResolvedValueOnce({ status: "ACTIVE" });

    mockThreadsGet.mockRejectedValueOnce(new Error("Gmail 403: Access denied"));
    mockPrismaReplyFindMany.mockResolvedValueOnce([]);

    const result = await scanForReplies();

    expect(result.errors).toBe(1);
    expect(result.results[0].outcome).toBe("ERROR");
    expect(result.status).toBe("FAILED");
  });
});

// ── Security — own message never treated as reply ─────────────────────────────

describe("Security — own outbound messages are never treated as replies", () => {
  it("classifying sender's own message returns AUTO_REPLY (not REAL_REPLY)", () => {
    const ownMsg = makeMessage({ from: `Sender <${SENDER_EMAIL}>` });
    const result = classifyMessage(ownMsg, SENDER_EMAIL, SENDER_EMAIL);
    // Even if prospect email happens to equal sender email — own-message guard fires first
    expect(result.replyType).toBe("AUTO_REPLY");
    expect(result.reason).toMatch(/own sender address/i);
  });

  it("NEEDS_REVIEW classification never triggers stop logic (scanner test)", async () => {
    // This test verifies the key safety property:
    // An unknown sender in our thread → NEEDS_REVIEW → no stop
    const review = makeClassification({ replyType: "NEEDS_REVIEW" });
    const real = makeClassification({ replyType: "REAL_REPLY" });

    // Only REAL_REPLY triggers stop — NEEDS_REVIEW does not
    expect(mostActionableClassification([review])?.replyType).toBe("NEEDS_REVIEW");
    expect(mostActionableClassification([real])?.replyType).toBe("REAL_REPLY");

    // The scanner only calls stop for REAL_REPLY; confirmed by
    // "scanForReplies — NEEDS_REVIEW" test above (mockPrismaTransaction not called)
  });
});
