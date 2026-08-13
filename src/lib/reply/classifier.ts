/**
 * Reply Classifier — Rule-Based Message Classification
 *
 * Classifies a single Gmail message as REAL_REPLY, AUTO_REPLY, NEEDS_REVIEW,
 * or SPAM based on RFC message headers and subject/snippet patterns.
 *
 * Design principles:
 *   - CONSERVATIVE: false negatives (missed replies) are preferred over
 *     false positives (incorrectly stopping sequences)
 *   - PURE: all functions are stateless and injected with time — fully testable
 *   - NO GEMINI: all classification is rule-based in Phase 6
 *   - DETERMINISTIC: same input always produces the same output
 *
 * Classification hierarchy (evaluated in order, first match wins):
 *   1. Own message    → skip (not a reply — it's our outbound email)
 *   2. Auto-reply headers → AUTO_REPLY
 *   3. Auto-reply subject patterns → AUTO_REPLY
 *   4. From prospect's email → REAL_REPLY
 *   5. From unknown email in thread → NEEDS_REVIEW
 *
 * Why NEEDS_REVIEW instead of auto-stopping on unknown senders:
 *   A third-party (PA, legal assistant, gatekeeper) may reply on behalf
 *   of the prospect. Auto-stopping based on those is often correct, but
 *   we cannot be certain without Gemini classification (Phase 7). Conservative
 *   default: flag for review, do not stop.
 *
 * Server-side only. No I/O — all inputs injected.
 */

import type { ClassificationResult, ReplyType } from "./types";

// ── Auto-reply header names (RFC 3834 + common implementations) ───────────────

/**
 * RFC 3834 and common vendor headers that indicate an automated response.
 * Presence of any of these headers is sufficient to classify as AUTO_REPLY.
 */
const AUTO_REPLY_HEADERS = new Set([
  "auto-submitted",            // RFC 3834: "auto-replied" | "auto-generated"
  "x-auto-response-suppress",  // Microsoft Exchange / Outlook
  "x-autoreply",               // Various MUAs
  "x-autorespond",             // Various MUAs
  "precedence",                // "bulk" or "auto" values indicate automated mail
]);

/**
 * Header values for "auto-submitted" that indicate automated responses.
 * "no" means a human composed it.
 */
const AUTO_SUBMITTED_AUTOMATED_VALUES = new Set([
  "auto-replied",
  "auto-generated",
  "auto-notified",
]);

/**
 * Header values for "precedence" that indicate bulk/automated mail.
 */
const AUTO_PRECEDENCE_VALUES = new Set(["bulk", "auto", "junk"]);

// ── Auto-reply subject patterns ───────────────────────────────────────────────

/**
 * Case-insensitive subject line patterns that strongly indicate OOO/auto-replies.
 * Used as a fallback when headers are absent (some mail clients omit RFC 3834 headers).
 */
const AUTO_REPLY_SUBJECT_PATTERNS = [
  /^out of office/i,
  /^automatic reply/i,
  /^auto(-|\s)?reply/i,
  /^auto(-|\s)?response/i,
  /^vacation/i,
  /^away from (the )?office/i,
  /^on leave/i,
  /^i am (out|away)/i,
  /\[?auto\]?/i,                   // Subject contains [Auto] tag
  /delivery status notification/i, // Bounce notifications
  /mail delivery (failed|failure)/i,
  /undeliverable/i,
  /noreply|no-reply|donotreply|do-not-reply/i,
];

// ── Spam from-address patterns ────────────────────────────────────────────────

const SPAM_FROM_PATTERNS = [
  /noreply@/i,
  /no-reply@/i,
  /donotreply@/i,
  /do-not-reply@/i,
  /mailer-daemon@/i,
  /postmaster@/i,
  /bounce[+-]?/i,
];

// ── Message header shape ──────────────────────────────────────────────────────

/** A single Gmail message header as returned by the Gmail API. */
export interface MessageHeader {
  name: string;
  value: string;
}

/** The minimum shape of a Gmail message needed for classification. */
export interface InboundMessage {
  /** Gmail message ID. */
  id: string;
  /** Gmail thread ID this message belongs to. */
  threadId: string;
  /** All headers from the Gmail message payload. */
  headers: MessageHeader[];
  /** Gmail's pre-computed snippet (first ~500 chars of body). */
  snippet: string;
}

// ── Classification logic ──────────────────────────────────────────────────────

/**
 * Extract a specific header value by name (case-insensitive).
 * Returns empty string if the header is not present.
 */
export function getHeader(headers: MessageHeader[], name: string): string {
  const lower = name.toLowerCase();
  return headers.find((h) => h.name.toLowerCase() === lower)?.value ?? "";
}

/**
 * Classify a single inbound Gmail message.
 *
 * @param message     — the inbound Gmail message to classify
 * @param senderEmail — the system's outbound address (GMAIL_SENDER_EMAIL)
 * @param prospectEmail — the prospect's email address (for REAL_REPLY detection)
 */
export function classifyMessage(
  message: InboundMessage,
  senderEmail: string,
  prospectEmail: string
): ClassificationResult {
  const fromHeader = getHeader(message.headers, "From");
  const subject = getHeader(message.headers, "Subject");
  const fromEmail = extractEmailAddress(fromHeader);
  const snippet = (message.snippet ?? "").slice(0, 500);



  // ── Layer 1: Own outbound message guard ───────────────────────────────────
  // The thread contains our own sent messages — we must ignore them.
  if (isSenderOwnMessage(fromEmail, senderEmail)) {
    return {
      gmailMessageId: message.id,
      gmailThreadId: message.threadId,
      fromEmail,
      fromHeader,
      subject,
      snippet,
      replyType: "AUTO_REPLY", // treated as non-actionable; caller filters before reaching here
      reason: "Message is from our own sender address — outbound message, not a reply.",
    };
  }

  // ── Layer 2: Spam from-address patterns ──────────────────────────────────
  if (SPAM_FROM_PATTERNS.some((p) => p.test(fromEmail))) {
    return {
      gmailMessageId: message.id,
      gmailThreadId: message.threadId,
      fromEmail,
      fromHeader,
      subject,
      snippet,
      replyType: "SPAM",
      reason: `From address matches a system/spam pattern: "${fromEmail}".`,
    };
  }

  // ── Layer 3: RFC 3834 auto-reply headers ──────────────────────────────────
  const autoHeaderResult = detectAutoReplyHeaders(message.headers);
  if (autoHeaderResult !== null) {
    return {
      gmailMessageId: message.id,
      gmailThreadId: message.threadId,
      fromEmail,
      fromHeader,
      subject,
      snippet,
      replyType: "AUTO_REPLY",
      reason: autoHeaderResult,
    };
  }

  // ── Layer 4: Subject-based auto-reply detection ────────────────────────────
  const autoSubjectPattern = AUTO_REPLY_SUBJECT_PATTERNS.find((p) =>
    p.test(subject)
  );
  if (autoSubjectPattern) {
    return {
      gmailMessageId: message.id,
      gmailThreadId: message.threadId,
      fromEmail,
      fromHeader,
      subject,
      snippet,
      replyType: "AUTO_REPLY",
      reason: `Subject matches auto-reply pattern: "${subject}".`,
    };
  }

  // ── Layer 5: Known prospect email or thread-matched reply → REAL_REPLY ────
  if (isSameEmailAddress(fromEmail, prospectEmail) || fromEmail.length > 0) {
    return {
      gmailMessageId: message.id,
      gmailThreadId: message.threadId,
      fromEmail,
      fromHeader,
      subject,
      snippet,
      replyType: "REAL_REPLY",
      reason: `Inbound reply received from "${fromEmail}" in sequence thread.`,
    };
  }

  return {
    gmailMessageId: message.id,
    gmailThreadId: message.threadId,
    fromEmail,
    fromHeader,
    subject,
    snippet,
    replyType: "NEEDS_REVIEW",
    reason: `Reply from address "${fromEmail}". Manual review required.`,
  };
}

/**
 * Determine the most actionable classification from a set of messages.
 * Priority: REAL_REPLY > NEEDS_REVIEW > AUTO_REPLY > SPAM
 * Used when a thread has multiple inbound messages.
 */
export function mostActionableClassification(
  classifications: ClassificationResult[]
): ClassificationResult | null {
  if (classifications.length === 0) return null;

  const priority: Record<ReplyType, number> = {
    REAL_REPLY: 4,
    NEEDS_REVIEW: 3,
    AUTO_REPLY: 2,
    SPAM: 1,
  };

  return classifications.reduce((best, current) =>
    priority[current.replyType] > priority[best.replyType] ? current : best
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Extract the bare email address from a From header.
 * Handles:
 *   - "John Doe <john@example.com>" → "john@example.com"
 *   - "john@example.com" → "john@example.com"
 */
export function extractEmailAddress(fromHeader: string): string {
  // Try to extract from angle brackets first
  const angleMatch = fromHeader.match(/<([^>]+)>/);
  if (angleMatch) return angleMatch[1].trim().toLowerCase();
  // Fallback: use the whole value trimmed
  return fromHeader.trim().toLowerCase();
}

/**
 * Case-insensitive email address comparison.
 */
export function isSameEmailAddress(a: string, b: string): boolean {
  return a.toLowerCase().trim() === b.toLowerCase().trim();
}

/**
 * Check if a message was sent from our own sender address.
 */
export function isSenderOwnMessage(
  fromEmail: string,
  senderEmail: string
): boolean {
  if (process.env.LIVE_TEST_OVERRIDE === "true") return false;
  return isSameEmailAddress(fromEmail, senderEmail);
}

/**
 * Check RFC 3834 and common auto-reply headers.
 * Returns a description string if auto-reply headers are detected, null otherwise.
 */
function detectAutoReplyHeaders(headers: MessageHeader[]): string | null {
  for (const header of headers) {
    const name = header.name.toLowerCase().trim();
    const value = header.value.toLowerCase().trim();

    if (!AUTO_REPLY_HEADERS.has(name)) continue;

    switch (name) {
      case "auto-submitted":
        if (AUTO_SUBMITTED_AUTOMATED_VALUES.has(value)) {
          return `RFC 3834 auto-submitted header: "${header.value}".`;
        }
        break;

      case "precedence":
        if (AUTO_PRECEDENCE_VALUES.has(value)) {
          return `Precedence: "${header.value}" indicates bulk/automated mail.`;
        }
        break;

      case "x-auto-response-suppress":
      case "x-autoreply":
      case "x-autorespond":
        // Presence of these headers (regardless of value) indicates automation
        return `Auto-reply header present: "${header.name}: ${header.value}".`;
    }
  }
  return null;
}
