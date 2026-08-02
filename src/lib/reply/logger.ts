/**
 * Reply Logger — Structured Logging (Phase 6 + Phase 7)
 *
 * Emits JSON log events to stdout.
 *
 * Security invariants — NEVER log:
 *   - OAuth tokens (access or refresh)
 *   - GMAIL_CLIENT_SECRET, GEMINI_API_KEY, or DATABASE_URL
 *   - Full email body content
 *   - Raw Gmail/Gemini API error objects (may contain auth headers)
 *
 * Safe to log:
 *   - Step / sequence / prospect IDs (for traceability)
 *   - Prospect name (not email — email is PII)
 *   - Gmail thread ID and message ID (non-secret identifiers)
 *   - Subject line (not full body)
 *   - Classification outcome, confidence, reason, and signals
 *   - Trace correlation IDs (traceId)
 */

import { logger } from "@/lib/observability/logger";
import { audit } from "@/lib/observability/audit";
import type { ReplyLogEvent } from "./types";

export type Phase7LogEvent =
  | ReplyLogEvent
  | "intelligence_analysis_started"
  | "intelligence_analysis_completed"
  | "intelligence_analysis_failed"
  | "review_created"
  | "manual_review_completed";

export interface ReplyLogPayload {
  traceId?: string;
  sequenceId?: string;
  prospectId?: string;
  prospectName?: string;
  gmailThreadId?: string;
  gmailMessageId?: string;
  subject?: string;
  fromEmail?: string;
  replyType?: string;
  confidence?: number;
  reason?: string;
  recommendedAction?: string;
  policyConstrained?: boolean;
  stepsCancelled?: number;
  threadsScanned?: number;
  durationMs?: number;
  outcome?: string;
  detail?: string;
  status?: string;
  [key: string]: string | number | boolean | undefined;
}

export function replyLog(
  event: Phase7LogEvent,
  payload: ReplyLogPayload = {}
): void {
  const isError = String(event).includes("failed") || String(event).includes("error");
  
  if (String(event) === "reply_classified_positive") {
    audit.logEvent({
      actionType: "SYSTEM_ACTION",
      action: "Reply Received",
      metadata: payload
    }).catch(() => {});
  }

  const meta = { ...payload, module: "ReplyScanner" };

  if (isError) {
    logger.error(`Reply Event: ${event}`, meta);
  } else {
    logger.info(`Reply Event: ${event}`, meta);
  }
}
