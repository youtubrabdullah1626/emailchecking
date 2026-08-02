/**
 * Reply Intelligence Types — Phase 7
 *
 * Defines the contract for the advisory AI layer.
 *
 * NON-NEGOTIABLE SAFETY GUARANTEES:
 *   1. AI layer is purely advisory — it NEVER directly mutates database state,
 *      sends emails, touches OAuth credentials, or executes tools.
 *   2. Strict schema validation is applied to all model responses.
 *   3. Malformed, missing, out-of-bounds, or failed responses fall back
 *      safely to NEEDS_REVIEW with confidence = 0.0.
 */

import type { ReplyType } from "@prisma/client";

export type RecommendedAction = "STOP" | "KEEP_ACTIVE" | "NEEDS_REVIEW";
export type ProviderStatus = "SUCCESS" | "SAFE_FALLBACK";

/**
 * Sanitized context passed to the intelligence provider.
 * Strict privacy: NO OAuth tokens, DB credentials, or full email histories.
 */
export interface ReplyAnalysisInput {
  gmailMessageId: string;
  gmailThreadId: string;
  senderEmail: string;
  prospectEmail: string;
  prospectName: string;
  prospectCompany: string;
  subject: string;
  snippet: string;
  deterministicSignals?: string[];
}

/**
 * Validated structured output returned by the intelligence layer.
 */
export interface ReplyAnalysisResult {
  status: ProviderStatus;
  classification: ReplyType;
  confidence: number;
  reason: string;
  recommendedAction: RecommendedAction;
  signals: string[];
  fallbackReason?: string;
}

/**
 * Interface contract for intelligence providers (Gemini, Mock, etc.).
 * Allows switching providers without altering reply detection business logic.
 */
export interface ReplyIntelligenceProvider {
  analyzeReply(input: ReplyAnalysisInput): Promise<ReplyAnalysisResult>;
}
