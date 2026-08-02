/**
 * Intelligence Provider & Policy Engine Tests — Phase 7
 *
 * Tests the advisory AI layer:
 *   - GeminiProvider (mocked fetch)
 *   - Input sanitization & bounding
 *   - Runtime output validation (confidence range, enums, JSON parsing)
 *   - Safe fallback when API key is missing, network fails, or timeout occurs
 *   - Deterministic policy engine overrides (< 0.70 threshold, auto-reply bounds)
 */

import { GeminiProvider } from "@/lib/intelligence/provider";
import { evaluateIntelligencePolicy } from "@/lib/intelligence/policy";
import type { ReplyAnalysisInput } from "@/lib/intelligence/types";
import type { ClassificationResult } from "@/lib/reply/types";

// ── Global fetch mock ─────────────────────────────────────────────────────────

const globalFetch = jest.fn();
global.fetch = globalFetch as unknown as typeof fetch;

const ORIGINAL_ENV = process.env;

beforeEach(() => {
  jest.clearAllMocks();
  process.env = {
    ...ORIGINAL_ENV,
    GEMINI_API_KEY: "test-gemini-key",
    GEMINI_MODEL: "gemini-2.5-flash",
  };
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

const sampleInput: ReplyAnalysisInput = {
  gmailMessageId: "msg-101",
  gmailThreadId: "thread-101",
  senderEmail: "assistant@company.com",
  prospectEmail: "john@company.com",
  prospectName: "John Doe",
  prospectCompany: "Acme Corp",
  subject: "Re: Meeting",
  snippet: "John asked me to confirm the meeting for Tuesday.",
  deterministicSignals: ["Unknown sender address"],
};

const sampleDeterministicResult: ClassificationResult = {
  gmailMessageId: "msg-101",
  gmailThreadId: "thread-101",
  fromEmail: "assistant@company.com",
  fromHeader: "PA <assistant@company.com>",
  subject: "Re: Meeting",
  snippet: "John asked me to confirm...",
  replyType: "NEEDS_REVIEW",
  reason: "Reply from unknown address PA <assistant@company.com>",
};

// ── GeminiProvider Tests ──────────────────────────────────────────────────────

describe("GeminiProvider — Configuration & Fallback", () => {
  it("returns SAFE_FALLBACK when GEMINI_API_KEY is missing", async () => {
    delete process.env.GEMINI_API_KEY;
    const provider = new GeminiProvider();
    const result = await provider.analyzeReply(sampleInput);

    expect(result.status).toBe("SAFE_FALLBACK");
    expect(result.classification).toBe("NEEDS_REVIEW");
    expect(result.confidence).toBe(0.0);
    expect(result.fallbackReason).toMatch(/not configured/i);
    expect(globalFetch).not.toHaveBeenCalled();
  });

  it("returns SAFE_FALLBACK on HTTP 500 server error", async () => {
    globalFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    });

    const provider = new GeminiProvider();
    const result = await provider.analyzeReply(sampleInput);

    expect(result.status).toBe("SAFE_FALLBACK");
    expect(result.classification).toBe("NEEDS_REVIEW");
    expect(result.confidence).toBe(0.0);
    expect(result.fallbackReason).toMatch(/HTTP 500/);
  });

  it("returns SAFE_FALLBACK on network fetch rejection", async () => {
    globalFetch.mockRejectedValueOnce(new Error("Network connection reset"));

    const provider = new GeminiProvider();
    const result = await provider.analyzeReply(sampleInput);

    expect(result.status).toBe("SAFE_FALLBACK");
    expect(result.fallbackReason).toMatch(/Network connection reset/);
  });
});

describe("GeminiProvider — Output Validation", () => {
  it("parses valid JSON response and returns SUCCESS", async () => {
    const validJson = JSON.stringify({
      classification: "REAL_REPLY",
      confidence: 0.92,
      reason: "Assistant confirming meeting on behalf of prospect.",
      recommended_action: "STOP",
      signals: ["assistant reply", "meeting confirmation"],
    });

    globalFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: validJson }] } }],
      }),
    });

    const provider = new GeminiProvider();
    const result = await provider.analyzeReply(sampleInput);

    expect(result.status).toBe("SUCCESS");
    expect(result.classification).toBe("REAL_REPLY");
    expect(result.confidence).toBe(0.92);
    expect(result.recommendedAction).toBe("STOP");
    expect(result.signals).toContain("assistant reply");
  });

  it("returns SAFE_FALLBACK when JSON output is malformed", async () => {
    globalFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: "Invalid raw text { not json" }] } }],
      }),
    });

    const provider = new GeminiProvider();
    const result = await provider.analyzeReply(sampleInput);

    expect(result.status).toBe("SAFE_FALLBACK");
    expect(result.fallbackReason).toMatch(/parse/i);
  });

  it("returns SAFE_FALLBACK when confidence is out of bounds (> 1.0)", async () => {
    const badJson = JSON.stringify({
      classification: "REAL_REPLY",
      confidence: 1.5, // invalid
      reason: "Sure",
      recommended_action: "STOP",
      signals: [],
    });

    globalFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: badJson }] } }],
      }),
    });

    const provider = new GeminiProvider();
    const result = await provider.analyzeReply(sampleInput);

    expect(result.status).toBe("SAFE_FALLBACK");
    expect(result.fallbackReason).toMatch(/confidence/i);
  });

  it("returns SAFE_FALLBACK when confidence is negative (< 0.0)", async () => {
    const badJson = JSON.stringify({
      classification: "REAL_REPLY",
      confidence: -0.2, // invalid
      reason: "Sure",
      recommended_action: "STOP",
      signals: [],
    });

    globalFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: badJson }] } }],
      }),
    });

    const provider = new GeminiProvider();
    const result = await provider.analyzeReply(sampleInput);

    expect(result.status).toBe("SAFE_FALLBACK");
  });

  it("returns SAFE_FALLBACK when classification enum is invalid", async () => {
    const badJson = JSON.stringify({
      classification: "SUPER_REPLY", // invalid enum
      confidence: 0.8,
      reason: "Sure",
      recommended_action: "STOP",
      signals: [],
    });

    globalFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: badJson }] } }],
      }),
    });

    const provider = new GeminiProvider();
    const result = await provider.analyzeReply(sampleInput);

    expect(result.status).toBe("SAFE_FALLBACK");
    expect(result.fallbackReason).toMatch(/Invalid classification/i);
  });
});

// ── Policy Engine Tests ───────────────────────────────────────────────────────

describe("evaluateIntelligencePolicy", () => {
  it("forces NEEDS_REVIEW when confidence is below 0.70 threshold", async () => {
    const lowConfJson = JSON.stringify({
      classification: "REAL_REPLY",
      confidence: 0.55, // below 0.70 threshold
      reason: "Uncertain assistant reply.",
      recommended_action: "STOP",
      signals: ["maybe"],
    });

    globalFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: lowConfJson }] } }],
      }),
    });

    const evalResult = await evaluateIntelligencePolicy(sampleInput, sampleDeterministicResult);

    expect(evalResult.finalClassification).toBe("NEEDS_REVIEW");
    expect(evalResult.recommendedAction).toBe("NEEDS_REVIEW");
    expect(evalResult.policyConstrained).toBe(true);
  });

  it("prevents AI from stopping a sequence if deterministic classifier flagged AUTO_REPLY", async () => {
    const autoReplyDeterministic: ClassificationResult = {
      ...sampleDeterministicResult,
      replyType: "AUTO_REPLY",
      reason: "Out of Office header detected",
    };

    const stopJson = JSON.stringify({
      classification: "REAL_REPLY",
      confidence: 0.95,
      reason: "Claims it is a reply",
      recommended_action: "STOP",
      signals: [],
    });

    globalFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: stopJson }] } }],
      }),
    });

    const evalResult = await evaluateIntelligencePolicy(sampleInput, autoReplyDeterministic);

    expect(evalResult.recommendedAction).toBe("NEEDS_REVIEW");
    expect(evalResult.finalClassification).toBe("NEEDS_REVIEW");
    expect(evalResult.policyConstrained).toBe(true);
  });
});
