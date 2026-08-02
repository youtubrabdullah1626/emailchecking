/**
 * Gemini Reply Intelligence Provider — Phase 7
 *
 * Concrete implementation of `ReplyIntelligenceProvider` using Google Gemini API.
 *
 * Safety architecture:
 *   - Native Node fetch with AbortController timeout (8000ms)
 *   - Configurable model via process.env.GEMINI_MODEL (default: "gemini-2.5-flash")
 *   - Input context bounded and sanitized (subject max 200, snippet max 500)
 *   - NO secrets, DB credentials, or OAuth tokens passed
 *   - Strict runtime validation of structured model output
 *   - Returns SAFE_FALLBACK on missing API key, network failure, timeout, 4xx/5xx,
 *     malformed JSON, invalid confidence (<0 or >1), or invalid enum values.
 *
 * Server-side only.
 */

import type {
  ReplyIntelligenceProvider,
  ReplyAnalysisInput,
  ReplyAnalysisResult,
  RecommendedAction,
} from "./types";
import type { ReplyType } from "@prisma/client";

const DEFAULT_MODEL = "gemini-2.5-flash";
const TIMEOUT_MS = 8000;

export class GeminiProvider implements ReplyIntelligenceProvider {
  private apiKey: string | undefined;
  private model: string;

  constructor(apiKey?: string, model?: string) {
    this.apiKey = apiKey ?? process.env.GEMINI_API_KEY;
    this.model = model ?? process.env.GEMINI_MODEL ?? DEFAULT_MODEL;
  }

  async analyzeReply(input: ReplyAnalysisInput): Promise<ReplyAnalysisResult> {
    // ── 1. Fast fallback if API key is not configured ───────────────────────
    if (!this.apiKey) {
      return this.createFallbackResult(
        "GEMINI_API_KEY is not configured in environment variables."
      );
    }

    // ── 2. Sanitize and bound input fields ──────────────────────────────────
    const sanitizedSubject = (input.subject ?? "").slice(0, 200);
    const sanitizedSnippet = (input.snippet ?? "").slice(0, 500);

    const promptText = `You are an advisory email reply classifier for a personal B2B outreach system.
Analyze the following email reply received from a prospect and classify its intent.

PROSPECT: ${input.prospectName} (${input.prospectCompany}) <${input.prospectEmail}>
SENDER OF THIS REPLY: ${input.senderEmail}
SUBJECT: ${sanitizedSubject}
MESSAGE SNIPPET: ${sanitizedSnippet}
DETERMINISTIC SIGNALS: ${(input.deterministicSignals ?? []).join(", ") || "None"}

REQUIREMENTS:
Return ONLY a valid JSON object matching this exact schema:
{
  "classification": "REAL_REPLY" | "AUTO_REPLY" | "SPAM" | "UNSUBSCRIBE" | "NOT_INTERESTED" | "INTERESTED" | "NEEDS_REVIEW",
  "confidence": <number between 0.0 and 1.0>,
  "reason": "<short explanation, max 200 chars>",
  "recommended_action": "STOP" | "KEEP_ACTIVE" | "NEEDS_REVIEW",
  "signals": ["<key signal 1>", "<key signal 2>"]
}

RULES:
1. If the sender is an assistant/PA/colleague replying on behalf of the prospect with positive/neutral intent, classify as REAL_REPLY or INTERESTED with recommended_action STOP.
2. If it is an out-of-office or automated system message, classify as AUTO_REPLY with recommended_action KEEP_ACTIVE.
3. If it is spam or bounce, classify as SPAM with recommended_action KEEP_ACTIVE.
4. If ambiguous or unclear, classify as NEEDS_REVIEW with recommended_action NEEDS_REVIEW and confidence below 0.7.
5. Do NOT include markdown code fences or conversational text. Return raw JSON only.`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: promptText }],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json",
          },
        }),
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return this.createFallbackResult(
          `Gemini API HTTP ${response.status}: ${response.statusText}`
        );
      }

      const data = await response.json();
      const rawText =
        data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

      if (!rawText) {
        return this.createFallbackResult("Gemini returned empty response content.");
      }

      // ── 3. Parse and strictly validate JSON ─────────────────────────────
      return this.parseAndValidateResponse(rawText);
    } catch (err: unknown) {
      clearTimeout(timeoutId);

      if (err instanceof Error && err.name === "AbortError") {
        return this.createFallbackResult(
          `Gemini API request timed out after ${TIMEOUT_MS}ms.`
        );
      }

      const msg = err instanceof Error ? err.message : "Unknown fetch error";
      return this.createFallbackResult(`Gemini request failed: ${msg}`);
    }
  }

  /**
   * Parse raw text and strictly validate all fields.
   */
  private parseAndValidateResponse(rawText: string): ReplyAnalysisResult {
    let parsed: unknown;
    try {
      // Strip potential markdown fences if present
      const cleaned = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      return this.createFallbackResult(
        "Failed to parse Gemini output as JSON."
      );
    }

    if (typeof parsed !== "object" || parsed === null) {
      return this.createFallbackResult("Gemini output is not a JSON object.");
    }

    const obj = parsed as Record<string, unknown>;

    // Validate classification
    const VALID_TYPES: ReplyType[] = [
      "REAL_REPLY",
      "AUTO_REPLY",
      "SPAM",
      "UNSUBSCRIBE",
      "NOT_INTERESTED",
      "INTERESTED",
      "NEEDS_REVIEW",
    ];
    const classification = obj.classification as ReplyType;
    if (!VALID_TYPES.includes(classification)) {
      return this.createFallbackResult(
        `Invalid classification enum value: "${String(classification)}".`
      );
    }

    // Validate confidence
    const confidence = Number(obj.confidence);
    if (
      isNaN(confidence) ||
      !isFinite(confidence) ||
      confidence < 0.0 ||
      confidence > 1.0
    ) {
      return this.createFallbackResult(
        `Invalid confidence score: ${String(obj.confidence)}. Must be 0.0 <= confidence <= 1.0.`
      );
    }

    // Validate recommended_action
    const VALID_ACTIONS: RecommendedAction[] = ["STOP", "KEEP_ACTIVE", "NEEDS_REVIEW"];
    const recommendedAction = obj.recommended_action as RecommendedAction;
    if (!VALID_ACTIONS.includes(recommendedAction)) {
      return this.createFallbackResult(
        `Invalid recommended_action enum value: "${String(recommendedAction)}".`
      );
    }

    // Validate reason
    const reason = typeof obj.reason === "string" ? obj.reason.slice(0, 300) : "No reason provided.";

    // Validate signals
    let signals: string[] = [];
    if (Array.isArray(obj.signals)) {
      signals = obj.signals
        .filter((s): s is string => typeof s === "string")
        .slice(0, 10)
        .map((s) => s.slice(0, 100));
    }

    return {
      status: "SUCCESS",
      classification,
      confidence,
      reason,
      recommendedAction,
      signals,
    };
  }

  /**
   * Helper to construct a safe fallback result.
   */
  private createFallbackResult(reason: string): ReplyAnalysisResult {
    return {
      status: "SAFE_FALLBACK",
      classification: "NEEDS_REVIEW",
      confidence: 0.0,
      reason: `AI fallback: ${reason}`,
      recommendedAction: "NEEDS_REVIEW",
      signals: ["fallback:safe_default"],
      fallbackReason: reason,
    };
  }
}
