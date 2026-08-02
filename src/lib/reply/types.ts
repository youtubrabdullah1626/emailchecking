/**
 * Reply Detection Types — Phase 6
 *
 * All types for the reply detection and stop-logic pipeline.
 *
 * The reply detection system:
 *   1. Scans Gmail threads for each active sequence
 *   2. Classifies any inbound messages (real reply / auto-reply / uncertain)
 *   3. Triggers stop logic for confirmed REAL_REPLY messages
 *   4. Writes a ReplyClassification record and cancels future steps
 *
 * No Gemini is used in Phase 6. Classification is rule-based only.
 */

// ── Reply classification ──────────────────────────────────────────────────────

/**
 * The classification outcome for a single inbound Gmail message.
 * Mirrors the ReplyType enum in schema.prisma.
 */
export type ReplyType =
  | "REAL_REPLY"      // Genuine human reply — triggers sequence stop
  | "AUTO_REPLY"      // Automated OOO / bounce / system response — ignored
  | "NEEDS_REVIEW"    // Cannot classify confidently — flagged, sequence NOT stopped
  | "SPAM";           // Spam — ignored (UNSUBSCRIBE / INTERESTED / NOT_INTERESTED reserved for Phase 7 AI)

export interface ClassificationResult {
  gmailMessageId: string;
  gmailThreadId: string;
  /** Sender email address extracted from the From header. */
  fromEmail: string;
  /** The From header in full (may include display name). */
  fromHeader: string;
  /** Subject of the inbound message (for logging and snippet). */
  subject: string;
  /** First ~500 chars of the message body for review purposes. */
  snippet: string;
  /** The classification decision. */
  replyType: ReplyType;
  /** Human-readable reason for the classification — appears in logs and DB. */
  reason: string;
}

// ── Per-thread scan result ────────────────────────────────────────────────────

export type ThreadScanOutcome =
  | "NO_REPLIES"      // No inbound messages found
  | "AUTO_REPLY"      // Only auto-replies found
  | "NEEDS_REVIEW"    // At least one uncertain reply — not stopped
  | "REAL_REPLY"      // Real reply confirmed — stop logic fired
  | "ALREADY_STOPPED" // Sequence was already stopped or completed — skipped
  | "ERROR";          // Gmail API or DB error during scan

export interface ThreadScanResult {
  sequenceId: string;
  prospectId: string;
  prospectName: string;
  gmailThreadId: string;
  outcome: ThreadScanOutcome;
  /** Populated when outcome is REAL_REPLY or NEEDS_REVIEW. */
  classification?: ClassificationResult;
  detail: string;
}

// ── Batch scan result ─────────────────────────────────────────────────────────

export type ScanStatus = "SUCCESS" | "PARTIAL_FAILURE" | "FAILED" | "CONFIG_ERROR";

export interface ScanResult {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  /** Total active sequences scanned. */
  threadsScanned: number;
  noReplies: number;
  autoReplies: number;
  needsReview: number;
  realReplies: number;
  alreadyStopped: number;
  errors: number;
  /** Per-thread results. */
  results: ThreadScanResult[];
  status: ScanStatus;
}

// ── Stop action result ────────────────────────────────────────────────────────

export interface StopResult {
  sequenceId: string;
  prospectId: string;
  /** How many PENDING/PROCESSING steps were cancelled. */
  stepsCancelled: number;
  /** True if the sequence and prospect status were updated; false if already stopped. */
  stateUpdated: boolean;
  /** True if a ReplyClassification record was created. */
  classificationRecorded: boolean;
}

// ── Reply log events ──────────────────────────────────────────────────────────

export type ReplyLogEvent =
  | "reply_scan_started"
  | "reply_scan_thread_found"
  | "reply_thread_matched"
  | "reply_message_skipped_own"
  | "reply_message_skipped_system_outbound"
  | "reply_message_skipped_duplicate"
  | "reply_classified_real"
  | "reply_classified_auto"
  | "reply_classified_uncertain"
  | "sequence_stop_triggered"
  | "sequence_steps_cancelled"
  | "reply_processing_completed"
  | "reply_scan_error"
  | "reply_oauth_missing";
