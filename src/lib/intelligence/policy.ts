/**
 * Deterministic Intelligence Policy Engine — Phase 7
 *
 * Wraps intelligence provider results with strict deterministic safety rules.
 *
 * Safety Rules Enforced:
 *   1. AI recommendations are purely ADVISORY (RECOMMENDATION, never ACTION).
 *   2. AI output can NEVER directly trigger database state mutations.
 *   3. Confidence < 0.70 forces the outcome to NEEDS_REVIEW.
 *   4. AI CANNOT override a deterministic REAL_REPLY. (Deterministic REAL_REPLY
 *      already triggered applyReplyStop prior to intelligence evaluation).
 *   5. AI CANNOT convert an explicit AUTO_REPLY or SPAM into an automatic sequence stop.
 *   6. SAFE_FALLBACK results automatically preserve NEEDS_REVIEW status.
 *
 * Server-side only.
 */

import type { ClassificationResult } from "@/lib/reply/types";
import type { ReplyAnalysisResult, ReplyAnalysisInput } from "./types";
import { GeminiProvider } from "./provider";
import { replyLog } from "@/lib/reply/logger";

const MIN_CONFIDENCE_THRESHOLD = 0.70;

export interface PolicyEvaluationResult {
  /** The final classification for persistence in reply_classifications. */
  finalClassification: string;
  confidence: number;
  reason: string;
  recommendedAction: "STOP" | "KEEP_ACTIVE" | "NEEDS_REVIEW";
  signals: string[];
  /** Indicates if Gemini advisory intelligence was executed successfully. */
  aiEvaluated: boolean;
  /** Indicates if the policy altered or constrained the model recommendation. */
  policyConstrained: boolean;
}

/**
 * Evaluate intelligence policy on a message classified as NEEDS_REVIEW by deterministic rules.
 */
export async function evaluateIntelligencePolicy(
  input: ReplyAnalysisInput,
  deterministicResult: ClassificationResult
): Promise<PolicyEvaluationResult> {
  replyLog("intelligence_analysis_started", {
    gmailMessageId: input.gmailMessageId,
    gmailThreadId: input.gmailThreadId,
    prospectEmail: input.prospectEmail,
  });

  const provider = new GeminiProvider();
  const analysisResult: ReplyAnalysisResult = await provider.analyzeReply(input);

  let finalClassification = analysisResult.classification as string;
  let confidence = analysisResult.confidence;
  let recommendedAction = analysisResult.recommendedAction;
  let reason = analysisResult.reason;
  let signals = analysisResult.signals;
  let policyConstrained = false;

  // ── Rule 1: Fallback handling ─────────────────────────────────────────────
  if (analysisResult.status === "SAFE_FALLBACK") {
    replyLog("intelligence_analysis_failed", {
      gmailMessageId: input.gmailMessageId,
      detail: analysisResult.fallbackReason ?? "Unknown fallback",
    });

    return {
      finalClassification: "NEEDS_REVIEW",
      confidence: 0.0,
      reason: analysisResult.reason,
      recommendedAction: "NEEDS_REVIEW",
      signals: analysisResult.signals,
      aiEvaluated: false,
      policyConstrained: true,
    };
  }

  // ── Rule 2: Low confidence threshold bound (< 0.70) ───────────────────────
  if (confidence < MIN_CONFIDENCE_THRESHOLD) {
    policyConstrained = true;
    finalClassification = "NEEDS_REVIEW";
    recommendedAction = "NEEDS_REVIEW";
    reason = `[Low Confidence ${confidence.toFixed(2)}] ${reason}`;
    signals = [...signals, "policy:confidence_below_threshold"];
  }

  // ── Rule 3: Deterministic safety bounds ──────────────────────────────────
  // Deterministic AUTO_REPLY or SPAM cannot become an automatic sequence STOP
  if (
    (deterministicResult.replyType === "AUTO_REPLY" || deterministicResult.replyType === "SPAM") &&
    recommendedAction === "STOP"
  ) {
    policyConstrained = true;
    recommendedAction = "NEEDS_REVIEW";
    finalClassification = "NEEDS_REVIEW";
    reason = `[Policy Constraint] AI suggested STOP, but deterministic rule flagged ${deterministicResult.replyType}. Flagged for review.`;
    signals = [...signals, "policy:override_auto_reply_stop"];
  }

  replyLog("intelligence_analysis_completed", {
    gmailMessageId: input.gmailMessageId,
    classification: finalClassification,
    confidence,
    recommendedAction,
    policyConstrained,
  });

  return {
    finalClassification,
    confidence,
    reason,
    recommendedAction,
    signals,
    aiEvaluated: true,
    policyConstrained,
  };
}
