/**
 * Gmail Sender Types — Phase 5
 *
 * All types for the Gmail sending pipeline.
 * The scheduler (Phase 4) claims steps; Phase 5 sends them.
 */

// ── Per-step send result ──────────────────────────────────────────────────────

export type StepSendOutcome =
  | "SENT"           // Gmail accepted the message; DB updated to SENT
  | "FAILED"         // Gmail or DB failed; step marked FAILED
  | "ABORTED"        // Step was no longer PROCESSING when we checked (stale/cancelled)
  | "CONFIG_ERROR";  // OAuth not configured; step left in PROCESSING for retry

export interface StepSendResult {
  stepId: string;
  outcome: StepSendOutcome;
  /** Gmail message ID returned by the API on success. Null on non-SENT outcomes. */
  gmailMessageId?: string;
  /** Gmail thread ID returned by the API on success. Null on non-SENT outcomes. */
  gmailThreadId?: string;
  /** Human-readable description of the outcome for logging and API responses. */
  detail: string;
}

// ── Batch send result ─────────────────────────────────────────────────────────

export type BatchSendStatus = "SUCCESS" | "PARTIAL_FAILURE" | "FAILED" | "CONFIG_ERROR";

export interface BatchSendResult {
  /** ISO 8601 UTC — when the batch started. */
  startedAt: string;
  /** ISO 8601 UTC — when the batch finished. */
  finishedAt: string;
  durationMs: number;
  /** Total step IDs provided to the sender. */
  total: number;
  /** Steps successfully sent and marked SENT. */
  sent: number;
  /** Steps that failed to send; marked FAILED. */
  failed: number;
  /** Steps that were no longer PROCESSING (stale/cancelled); not sent. */
  aborted: number;
  /** Steps that could not be processed due to missing OAuth config. */
  configErrors: number;
  /** Per-step results. */
  results: StepSendResult[];
  /** Overall batch status. */
  status: BatchSendStatus;
}

// ── Full step data (loaded for sending) ───────────────────────────────────────

/**
 * Complete data needed to send one step.
 * Loaded fresh from DB immediately before send — includes body.
 * The scheduler query deliberately excludes body for log safety;
 * the sender loads it separately here.
 */
export interface StepForSend {
  id: string;
  step_number: number;
  subject: string;
  body: string;
  status: string;
  gmail_message_id: string | null;
  gmail_thread_id: string | null;
  sequence: {
    id: string;
    status: string;
    user_id: string;
    assigned_sender_email?: string | null;
    prospect: {
      id: string;
      name: string;
      email: string;
      status: string;
    };
  };
  /** The previous step in this sequence (if any) — used for thread continuation. */
  previousStep: {
    gmail_message_id: string | null;
    gmail_thread_id: string | null;
  } | null;
}

// ── Gmail log events ──────────────────────────────────────────────────────────

export type GmailLogEvent =
  | "gmail_send_started"
  | "gmail_send_verified_processing"
  | "gmail_send_success"
  | "gmail_send_failed"
  | "gmail_send_aborted_stale_step"
  | "gmail_send_aborted_sequence_paused"
  | "gmail_send_aborted_campaign_paused"
  | "gmail_send_aborted_attempt_write_failed"
  | "gmail_send_db_update_failed"
  | "gmail_batch_started"
  | "gmail_batch_completed"
  | "gmail_oauth_missing"
  | "gmail_oauth_error"
  | "gmail_send_aborted_limit"
  | "gmail_send_aborted_health"
  | "gmail_fetch_prev_msg_failed"
  | "gmail_tracking_pixel_disabled"
  | "gmail_human_delay"
  | "gmail_sticky_sender_unavailable"
  | "gmail_sticky_lock_failed"
  | "gmail_send_attempt_record_skipped"
  | "gmail_send_aborted_step_reset"
  | "gmail_send_aborted_pre_send_gate";



