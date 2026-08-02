/**
 * Gmail Logger — Structured Logging
 *
 * Follows the same pattern as src/lib/scheduler/logger.ts.
 * Emits one JSON line per event to stdout.
 *
 * Security invariants — NEVER log:
 *   - OAuth access tokens
 *   - OAuth refresh tokens
 *   - GMAIL_CLIENT_SECRET
 *   - DATABASE_URL or DIRECT_URL
 *   - Full email body text (body is loaded for send only, never logged)
 *   - Raw Gmail API error objects (may contain auth headers)
 *   - Stack traces that could expose secrets
 *
 * Safe to log:
 *   - Step IDs, prospect IDs, sequence IDs (for traceability)
 *   - Prospect name (for readability in logs)
 *   - Gmail message ID and thread ID (non-secret identifiers)
 *   - Subject line (no body — subject is not secret)
 *   - Outcome, status, and safe error messages
 */

import type { GmailLogEvent } from "./types";

export interface GmailLogPayload {
  stepId?: string;
  stepNumber?: number;
  prospectId?: string;
  prospectName?: string;
  sequenceId?: string;
  subject?: string;
  gmailMessageId?: string;
  gmailThreadId?: string;
  outcome?: string;
  detail?: string;
  durationMs?: number;
  total?: number;
  sent?: number;
  failed?: number;
  aborted?: number;
  status?: string;
  // Allow extra structured fields without explicit typing
  [key: string]: string | number | boolean | undefined;
}

export function gmailLog(
  event: GmailLogEvent,
  payload: GmailLogPayload = {}
): void {
  const line = {
    timestamp: new Date().toISOString(),
    event,
    ...payload,
  };
  console.log(JSON.stringify(line));
}
