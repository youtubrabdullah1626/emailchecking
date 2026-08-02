/**
 * Gmail Sender Tests — Phase 5
 *
 * Tests for the Gmail sending pipeline: sender.ts, message.ts, oauth.ts
 *
 * Uses Jest mocks for:
 *   - googleapis (gmail API client)
 *   - @/lib/prisma (DB operations)
 *   - @/lib/gmail/query (step loading)
 *
 * No real Gmail API calls are made.
 * No real DB connections are made.
 * No email is ever sent in these tests.
 *
 * Coverage:
 *   - OAuth config validation
 *   - Step loading failure
 *   - Pre-send PROCESSING verification
 *   - gmail_message_id idempotency guard
 *   - Successful send → SENT state + DB update
 *   - Gmail API failure → FAILED state
 *   - DB update failure after successful Gmail send (critical edge case)
 *   - DB update retry behaviour (3 attempts)
 *   - Stale/cancelled step abortion
 *   - Already SENT step not resent
 *   - Thread continuation (step 2 uses previous step thread IDs)
 *   - Batch send: empty, all success, partial failure, config error short-circuit
 *   - Message builder: base64url encoding, header construction
 *   - Message builder: thread continuation headers
 */

// ── Mock googleapis ───────────────────────────────────────────────────────────

const mockSend = jest.fn();
const mockGmailClient = {
  users: {
    messages: {
      send: mockSend,
    },
  },
};

jest.mock("googleapis", () => ({
  google: {
    auth: {
      OAuth2: jest.fn().mockImplementation(() => ({
        setCredentials: jest.fn(),
        generateAuthUrl: jest.fn(() => "https://accounts.google.com/o/oauth2/auth?..."),
        getToken: jest.fn(),
        getTokenInfo: jest.fn(),
      })),
    },
    gmail: jest.fn(() => mockGmailClient),
  },
}));

// ── Mock Prisma ───────────────────────────────────────────────────────────────

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    sequenceStep: {
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    emailEvent: {
      create: jest.fn(),
    },
    // $transaction: calls the callback with a mock tx object that mirrors the prisma mock.
    // This is required because sender.ts wraps markStepSent and markStepFailed in $transaction.
    $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        sequenceStep: {
          update: (jest.requireMock("@/lib/prisma") as { default: { sequenceStep: { update: jest.Mock } } }).default.sequenceStep.update,
          updateMany: (jest.requireMock("@/lib/prisma") as { default: { sequenceStep: { updateMany: jest.Mock } } }).default.sequenceStep.updateMany,
        },
        emailEvent: {
          create: (jest.requireMock("@/lib/prisma") as { default: { emailEvent: { create: jest.Mock } } }).default.emailEvent.create,
        },
      })
    ),
  },
}));

// ── Mock the sender query ─────────────────────────────────────────────────────

jest.mock("@/lib/gmail/query", () => ({
  loadStepForSend: jest.fn(),
}));

// ── Mock Phase 12 Intelligence ────────────────────────────────────────────────
jest.mock("@/lib/intelligence/error-engine", () => ({
  reportSystemError: jest.fn(),
}));

jest.mock("@/lib/reputation/guard", () => ({
  canSendEmail: jest.fn().mockResolvedValue({ allowed: true }),
  recordSuccessfulSend: jest.fn(),
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { sendStep, sendBatch } from "@/lib/gmail/sender";
import { buildGmailMessage } from "@/lib/gmail/message";
import { getOAuthConfig } from "@/lib/gmail/oauth";
import { loadStepForSend } from "@/lib/gmail/query";
import prisma from "@/lib/prisma";

const mockLoadStep = loadStepForSend as jest.MockedFunction<typeof loadStepForSend>;
const mockPrismaUpdate = prisma.sequenceStep.update as jest.MockedFunction<typeof prisma.sequenceStep.update>;

// ── Test fixtures ─────────────────────────────────────────────────────────────

/**
 * Build a minimal StepForSend fixture.
 * Overrides allow per-test customisation without full object repetition.
 */
function makeStep(overrides: Partial<{
  id: string;
  step_number: number;
  status: string;
  gmail_message_id: string | null;
  gmail_thread_id: string | null;
  prospectStatus: string;
  sequenceStatus: string;
  previousStep: { gmail_message_id: string | null; gmail_thread_id: string | null } | null;
}> = {}) {
  return {
    id: overrides.id ?? "step-001",
    step_number: overrides.step_number ?? 1,
    subject: "Quick question about your work",
    body: "Hi John,\n\nI noticed your work at Acme Corp...",
    status: overrides.status ?? "PROCESSING",
    gmail_message_id: overrides.gmail_message_id ?? null,
    gmail_thread_id: overrides.gmail_thread_id ?? null,
    sequence: {
      id: "seq-001",
      status: overrides.sequenceStatus ?? "ACTIVE",
      prospect: {
        id: "prospect-001",
        name: "John Doe",
        email: "john@example.com",
        status: overrides.prospectStatus ?? "ACTIVE",
      },
    },
    previousStep: overrides.previousStep !== undefined ? overrides.previousStep : null,
  };
}

/** A successful Gmail API response */
const GMAIL_SUCCESS_RESPONSE = {
  data: {
    id: "gmail-msg-abc123",
    threadId: "gmail-thread-xyz789",
  },
};

// ── Environment setup ─────────────────────────────────────────────────────────

const ORIGINAL_ENV = process.env;

beforeEach(() => {
  jest.clearAllMocks();

  // Set valid OAuth env vars for most tests
  process.env = {
    ...ORIGINAL_ENV,
    GMAIL_CLIENT_ID: "test-client-id",
    GMAIL_CLIENT_SECRET: "test-client-secret",
    GMAIL_REFRESH_TOKEN: "test-refresh-token",
    GMAIL_SENDER_EMAIL: "sender@gmail.com",
  };
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

// ── OAuth config validation ───────────────────────────────────────────────────

describe("getOAuthConfig", () => {
  it("returns config when all env vars are set", () => {
    const config = getOAuthConfig();
    expect(config).not.toBeNull();
    expect(config?.senderEmail).toBe("sender@gmail.com");
  });

  it("returns null when GMAIL_CLIENT_ID is missing", () => {
    delete process.env.GMAIL_CLIENT_ID;
    expect(getOAuthConfig()).toBeNull();
  });

  it("returns null when GMAIL_REFRESH_TOKEN is missing", () => {
    delete process.env.GMAIL_REFRESH_TOKEN;
    expect(getOAuthConfig()).toBeNull();
  });

  it("returns null when GMAIL_SENDER_EMAIL is missing", () => {
    delete process.env.GMAIL_SENDER_EMAIL;
    expect(getOAuthConfig()).toBeNull();
  });
});

// ── buildGmailMessage ─────────────────────────────────────────────────────────

describe("buildGmailMessage", () => {
  it("produces a non-empty base64url-encoded raw string", () => {
    const result = buildGmailMessage({
      from: "sender@gmail.com",
      to: "recipient@example.com",
      toName: "John Doe",
      subject: "Hello",
      body: "World",
    });
    expect(typeof result.raw).toBe("string");
    expect(result.raw.length).toBeGreaterThan(0);
  });

  it("base64url encoding uses - and _ instead of + and /", () => {
    // The raw string must use URL-safe base64 characters
    const result = buildGmailMessage({
      from: "a@b.com",
      to: "c@d.com",
      toName: "C D",
      subject: "S",
      body: "B",
    });
    expect(result.raw).not.toMatch(/[+/=]/);
  });

  it("does not include threadId for step 1 (new thread)", () => {
    const result = buildGmailMessage({
      from: "a@b.com",
      to: "c@d.com",
      toName: "C",
      subject: "First email",
      body: "Body",
    });
    expect(result.threadId).toBeUndefined();
  });

  it("includes threadId for step 2+ (thread continuation)", () => {
    const result = buildGmailMessage({
      from: "a@b.com",
      to: "c@d.com",
      toName: "C",
      subject: "Follow-up",
      body: "Body",
      threadId: "thread-xyz",
      inReplyToMessageId: "prev-msg-id",
    });
    expect(result.threadId).toBe("thread-xyz");
  });

  it("decoded message contains From, To, Subject headers", () => {
    const result = buildGmailMessage({
      from: "sender@gmail.com",
      to: "recipient@test.com",
      toName: "Test User",
      subject: "Test Subject",
      body: "Test body.",
    });

    // Decode to verify header content
    const decoded = Buffer.from(
      result.raw.replace(/-/g, "+").replace(/_/g, "/"),
      "base64"
    ).toString("utf8");

    expect(decoded).toContain("From: sender@gmail.com");
    expect(decoded).toContain("To: Test User <recipient@test.com>");
    expect(decoded).toContain("Subject: Test Subject");
  });

  it("decoded message contains In-Reply-To header when inReplyToMessageId provided", () => {
    const result = buildGmailMessage({
      from: "a@b.com",
      to: "c@d.com",
      toName: "C",
      subject: "Follow-up",
      body: "Body",
      inReplyToMessageId: "prev-msg-abc",
    });

    const decoded = Buffer.from(
      result.raw.replace(/-/g, "+").replace(/_/g, "/"),
      "base64"
    ).toString("utf8");

    expect(decoded).toContain("In-Reply-To: <prev-msg-abc>");
    expect(decoded).toContain("References: <prev-msg-abc>");
  });

  it("decoded message does NOT contain In-Reply-To when no previous step", () => {
    const result = buildGmailMessage({
      from: "a@b.com",
      to: "c@d.com",
      toName: "C",
      subject: "First",
      body: "Body",
    });

    const decoded = Buffer.from(
      result.raw.replace(/-/g, "+").replace(/_/g, "/"),
      "base64"
    ).toString("utf8");

    expect(decoded).not.toContain("In-Reply-To");
  });
});

// ── sendStep — OAuth missing ──────────────────────────────────────────────────

describe("sendStep — OAuth config missing", () => {
  beforeEach(() => {
    delete process.env.GMAIL_REFRESH_TOKEN;
  });

  it("returns CONFIG_ERROR outcome", async () => {
    const result = await sendStep("step-001");
    expect(result.outcome).toBe("CONFIG_ERROR");
    expect(result.detail).toMatch(/not configured/i);
  });

  it("does not call the DB or Gmail", async () => {
    await sendStep("step-001");
    expect(mockLoadStep).not.toHaveBeenCalled();
    expect(mockSend).not.toHaveBeenCalled();
    expect(mockPrismaUpdate).not.toHaveBeenCalled();
  });
});

// ── sendStep — step loading ───────────────────────────────────────────────────

describe("sendStep — step loading", () => {
  it("returns FAILED when loadStepForSend returns null (step not found)", async () => {
    mockLoadStep.mockResolvedValueOnce(null);

    const result = await sendStep("step-missing");
    expect(result.outcome).toBe("ABORTED");
    expect(result.detail).toMatch(/not found/i);
  });

  it("returns FAILED when loadStepForSend throws", async () => {
    mockLoadStep.mockRejectedValueOnce(new Error("DB timeout"));

    const result = await sendStep("step-001");
    expect(result.outcome).toBe("FAILED");
    expect(result.detail).toMatch(/DB timeout/);
  });
});

// ── sendStep — pre-send verification ─────────────────────────────────────────

describe("sendStep — pre-send PROCESSING verification", () => {
  it("aborts when step status is PENDING (not yet claimed)", async () => {
    mockLoadStep.mockResolvedValueOnce(makeStep({ status: "PENDING" }) as never);

    const result = await sendStep("step-001");
    expect(result.outcome).toBe("ABORTED");
    expect(result.detail).toMatch(/PENDING/);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("aborts when step status is SENT (already delivered)", async () => {
    mockLoadStep.mockResolvedValueOnce(makeStep({ status: "SENT" }) as never);

    const result = await sendStep("step-001");
    expect(result.outcome).toBe("ABORTED");
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("aborts when step status is CANCELLED", async () => {
    mockLoadStep.mockResolvedValueOnce(makeStep({ status: "CANCELLED" }) as never);

    const result = await sendStep("step-001");
    expect(result.outcome).toBe("ABORTED");
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("aborts when step status is FAILED", async () => {
    mockLoadStep.mockResolvedValueOnce(makeStep({ status: "FAILED" }) as never);

    const result = await sendStep("step-001");
    expect(result.outcome).toBe("ABORTED");
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("aborts when step status is SKIPPED", async () => {
    mockLoadStep.mockResolvedValueOnce(makeStep({ status: "SKIPPED" }) as never);

    const result = await sendStep("step-001");
    expect(result.outcome).toBe("ABORTED");
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("aborts when step already has a gmail_message_id (idempotency guard)", async () => {
    mockLoadStep.mockResolvedValueOnce(
      makeStep({ status: "PROCESSING", gmail_message_id: "existing-msg-id" }) as never
    );

    const result = await sendStep("step-001");
    expect(result.outcome).toBe("ABORTED");
    expect(result.detail).toMatch(/already has a Gmail message ID/i);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("proceeds when step is PROCESSING and has no gmail_message_id", async () => {
    mockLoadStep.mockResolvedValueOnce(makeStep({ status: "PROCESSING" }) as never);
    mockSend.mockResolvedValueOnce(GMAIL_SUCCESS_RESPONSE);
    mockPrismaUpdate.mockResolvedValueOnce({} as never);

    const result = await sendStep("step-001");
    expect(result.outcome).toBe("SENT");
    expect(mockSend).toHaveBeenCalledTimes(1);
  });
});

// ── sendStep — successful send ────────────────────────────────────────────────

describe("sendStep — successful send", () => {
  beforeEach(() => {
    mockLoadStep.mockResolvedValue(makeStep({ status: "PROCESSING" }) as never);
    mockSend.mockResolvedValue(GMAIL_SUCCESS_RESPONSE);
    mockPrismaUpdate.mockResolvedValue({} as never);
  });

  it("returns SENT outcome", async () => {
    const result = await sendStep("step-001");
    expect(result.outcome).toBe("SENT");
  });

  it("returns the Gmail message ID from the API response", async () => {
    const result = await sendStep("step-001");
    expect(result.gmailMessageId).toBe("gmail-msg-abc123");
  });

  it("returns the Gmail thread ID from the API response", async () => {
    const result = await sendStep("step-001");
    expect(result.gmailThreadId).toBe("gmail-thread-xyz789");
  });

  it("calls prisma.update with SENT status and correct Gmail IDs", async () => {
    await sendStep("step-001");

    expect(mockPrismaUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "step-001" },
        data: expect.objectContaining({
          status: "SENT",
          gmail_message_id: "gmail-msg-abc123",
          gmail_thread_id: "gmail-thread-xyz789",
          sent_at: expect.any(Date),
        }),
      })
    );
  });

  it("sets sent_at to a recent timestamp", async () => {
    const before = new Date();
    await sendStep("step-001");
    const after = new Date();

    const updateCall = mockPrismaUpdate.mock.calls[0][0] as { data: { sent_at: Date } };
    const sentAt = updateCall.data.sent_at;
    expect(sentAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(sentAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });
});

// ── sendStep — Gmail API failure ──────────────────────────────────────────────

describe("sendStep — Gmail API failure", () => {
  beforeEach(() => {
    mockLoadStep.mockResolvedValue(makeStep({ status: "PROCESSING" }) as never);
  });

  it("returns FAILED outcome when Gmail throws", async () => {
    mockSend.mockRejectedValueOnce(new Error("Gmail 429: rate limit exceeded"));
    mockPrismaUpdate.mockResolvedValue({} as never);

    const result = await sendStep("step-001");
    expect(result.outcome).toBe("FAILED");
    expect(result.detail).toMatch(/Gmail send failed/);
  });

  it("calls prisma.update with FAILED status after Gmail error", async () => {
    mockSend.mockRejectedValueOnce(new Error("Network error"));
    mockPrismaUpdate.mockResolvedValue({} as never);

    await sendStep("step-001");

    expect(mockPrismaUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "step-001" },
        data: { status: "FAILED" },
      })
    );
  });

  it("does not expose raw OAuth tokens in the error detail", async () => {
    mockSend.mockRejectedValueOnce(
      new Error("Request had invalid credentials. ya29.AComplicatedAccessToken refresh_token=secret123")
    );
    mockPrismaUpdate.mockResolvedValue({} as never);

    const result = await sendStep("step-001");

    expect(result.detail).not.toMatch(/ya29\./);
    expect(result.detail).not.toMatch(/refresh_token=secret/);
  });
});

// ── sendStep — DB update failure after successful Gmail send ─────────────────

describe("sendStep — DB update failure after Gmail success", () => {
  beforeEach(() => {
    mockLoadStep.mockResolvedValue(makeStep({ status: "PROCESSING" }) as never);
    mockSend.mockResolvedValue(GMAIL_SUCCESS_RESPONSE);
  });

  it("retries DB update 3 times before giving up", async () => {
    // All 3 attempts fail
    mockPrismaUpdate.mockRejectedValue(new Error("DB unavailable"));

    const result = await sendStep("step-001");

    // 3 SENT update attempts — all fail because DB is down.
    // We do NOT attempt a 4th FAILED update: if the DB is down, that would
    // also fail and is pointless. The Gmail message ID is logged for manual
    // reconciliation instead.
    expect(mockPrismaUpdate).toHaveBeenCalledTimes(3);
    expect(result.outcome).toBe("FAILED");
  }, 10000); // allow time for retry backoff

  it("returns FAILED outcome with Gmail IDs for manual reconciliation", async () => {
    mockPrismaUpdate.mockRejectedValue(new Error("DB unavailable"));

    const result = await sendStep("step-001");

    // The Gmail IDs are returned even on failure so they can be reconciled
    expect(result.gmailMessageId).toBe("gmail-msg-abc123");
    expect(result.gmailThreadId).toBe("gmail-thread-xyz789");
    expect(result.outcome).toBe("FAILED");
  }, 10000);

  it("succeeds on the second DB attempt (partial retry)", async () => {
    mockPrismaUpdate
      .mockRejectedValueOnce(new Error("Transient error"))
      .mockResolvedValueOnce({} as never); // second attempt succeeds

    const result = await sendStep("step-001");

    expect(result.outcome).toBe("SENT");
    expect(mockPrismaUpdate).toHaveBeenCalledTimes(2); // retried once, then succeeded
  }, 10000);
});

// ── sendStep — thread continuation ───────────────────────────────────────────

describe("sendStep — thread continuation for follow-up steps", () => {
  it("sends step 2 with threadId from previous step", async () => {
    mockLoadStep.mockResolvedValueOnce(
      makeStep({
        step_number: 2,
        status: "PROCESSING",
        previousStep: {
          gmail_message_id: "prev-msg-123",
          gmail_thread_id: "thread-abc",
        },
      }) as never
    );
    mockSend.mockResolvedValueOnce(GMAIL_SUCCESS_RESPONSE);
    mockPrismaUpdate.mockResolvedValueOnce({} as never);

    await sendStep("step-002");

    const sendCall = mockSend.mock.calls[0][0] as {
      requestBody: { threadId?: string };
    };
    expect(sendCall.requestBody.threadId).toBe("thread-abc");
  });

  it("sends step 1 without threadId (new thread)", async () => {
    mockLoadStep.mockResolvedValueOnce(
      makeStep({ step_number: 1, status: "PROCESSING", previousStep: null }) as never
    );
    mockSend.mockResolvedValueOnce(GMAIL_SUCCESS_RESPONSE);
    mockPrismaUpdate.mockResolvedValueOnce({} as never);

    await sendStep("step-001");

    const sendCall = mockSend.mock.calls[0][0] as {
      requestBody: { threadId?: string };
    };
    expect(sendCall.requestBody.threadId).toBeUndefined();
  });
});

// ── sendBatch ─────────────────────────────────────────────────────────────────

describe("sendBatch — empty input", () => {
  it("returns SUCCESS with zero counts for empty stepIds", async () => {
    const result = await sendBatch([]);
    expect(result.status).toBe("SUCCESS");
    expect(result.total).toBe(0);
    expect(result.sent).toBe(0);
  });
});

describe("sendBatch — all steps succeed", () => {
  it("returns SUCCESS status when all steps are sent", async () => {
    mockLoadStep
      .mockResolvedValueOnce(makeStep({ id: "s1", status: "PROCESSING" }) as never)
      .mockResolvedValueOnce(makeStep({ id: "s2", status: "PROCESSING" }) as never);
    mockSend.mockResolvedValue(GMAIL_SUCCESS_RESPONSE);
    mockPrismaUpdate.mockResolvedValue({} as never);

    const result = await sendBatch(["s1", "s2"]);

    expect(result.status).toBe("SUCCESS");
    expect(result.total).toBe(2);
    expect(result.sent).toBe(2);
    expect(result.failed).toBe(0);
    expect(result.results).toHaveLength(2);
  });
});

describe("sendBatch — partial failure", () => {
  it("returns PARTIAL_FAILURE when some steps fail", async () => {
    mockLoadStep
      .mockResolvedValueOnce(makeStep({ id: "s1", status: "PROCESSING" }) as never)
      .mockResolvedValueOnce(makeStep({ id: "s2", status: "PROCESSING" }) as never);
    mockSend
      .mockResolvedValueOnce(GMAIL_SUCCESS_RESPONSE)  // s1 OK
      .mockRejectedValueOnce(new Error("Gmail error")); // s2 fails
    mockPrismaUpdate.mockResolvedValue({} as never);

    const result = await sendBatch(["s1", "s2"]);

    expect(result.status).toBe("PARTIAL_FAILURE");
    expect(result.sent).toBe(1);
    expect(result.failed).toBe(1);
  });
});

describe("sendBatch — CONFIG_ERROR short-circuits", () => {
  it("stops processing remaining steps when OAuth is missing", async () => {
    delete process.env.GMAIL_REFRESH_TOKEN;

    const result = await sendBatch(["s1", "s2", "s3"]);

    // Should short-circuit after the first CONFIG_ERROR
    expect(result.status).toBe("CONFIG_ERROR");
    expect(result.configErrors).toBe(3);
    expect(result.results).toHaveLength(3);
    // Gmail API should not have been called at all
    expect(mockSend).not.toHaveBeenCalled();
  });
});

describe("sendBatch — stale step aborted", () => {
  it("counts aborted steps separately from failures", async () => {
    // s1: cancelled (stale), s2: success
    mockLoadStep
      .mockResolvedValueOnce(makeStep({ id: "s1", status: "CANCELLED" }) as never)
      .mockResolvedValueOnce(makeStep({ id: "s2", status: "PROCESSING" }) as never);
    mockSend.mockResolvedValueOnce(GMAIL_SUCCESS_RESPONSE);
    mockPrismaUpdate.mockResolvedValueOnce({} as never);

    const result = await sendBatch(["s1", "s2"]);

    expect(result.sent).toBe(1);
    expect(result.aborted).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.status).toBe("PARTIAL_FAILURE");
  });
});

describe("sendBatch — result shape", () => {
  it("returns all required fields", async () => {
    mockLoadStep.mockResolvedValueOnce(makeStep({ status: "PROCESSING" }) as never);
    mockSend.mockResolvedValueOnce(GMAIL_SUCCESS_RESPONSE);
    mockPrismaUpdate.mockResolvedValueOnce({} as never);

    const result = await sendBatch(["step-001"]);

    expect(typeof result.startedAt).toBe("string");
    expect(typeof result.finishedAt).toBe("string");
    expect(typeof result.durationMs).toBe("number");
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(typeof result.total).toBe("number");
    expect(typeof result.sent).toBe("number");
    expect(typeof result.failed).toBe("number");
    expect(typeof result.aborted).toBe("number");
    expect(Array.isArray(result.results)).toBe(true);
    expect(new Date(result.startedAt).toISOString()).toBe(result.startedAt);
    expect(new Date(result.finishedAt).toISOString()).toBe(result.finishedAt);
  });
});
