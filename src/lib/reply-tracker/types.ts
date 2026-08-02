/**
 * Gmail Reply Tracker — Shared Types
 *
 * All domain types, DTOs, and event enums for the push-notification-based
 * reply tracking system (reply-tracker module).
 *
 * Architecture context:
 *   Gmail sends a PubSub push notification to /api/webhooks/gmail when the
 *   mailbox changes. The engine fetches the history delta, matches changed
 *   messages to active sequences, and delegates classification + stop logic
 *   to the existing reply pipeline (src/lib/reply/*).
 *
 * Relationship to existing types:
 *   - ClassificationResult and ReplyType are imported FROM src/lib/reply/types.ts.
 *     They are NOT redefined here. This file only contains reply-tracker-specific
 *     DTOs that do not belong in the core reply pipeline.
 *
 * Multi-User SaaS Support:
 *   Supports thousands of independent connected Gmail accounts with isolated OAuth
 *   tokens, history cursors, watch states, and self-healing health monitors.
 *
 * Server-side only. Never import from client components.
 */

// ── Multi-User Account & Health Monitor ─────────────────────────────────────

export type AccountHealthStatus =
  | "HEALTHY"            // Active, valid watch, valid OAuth tokens
  | "SYNCING"            // Currently processing history delta
  | "EXPIRING_SOON"      // Watch expires in < 24 hours — auto-renewal scheduled
  | "EXPIRED"            // Watch expired — self-healing re-registration needed
  | "NEEDS_RECONNECT"    // Refresh token invalid/revoked — user re-auth needed
  | "DISCONNECTED";      // Account manually unlinked by user

export interface AccountHealthSummary {
  email: string;
  userId: string | null;
  connectionStatus: string;
  healthStatus: AccountHealthStatus;
  historyId: string | null;
  expiresAt: string | null;
  msUntilExpiry: number | null;
  needsWatchRenewal: boolean;
  errorCount: number;
  lastError: string | null;
  lastSyncedAt: string | null;
  autoHealedAt: string | null;
  hasRefreshToken: boolean;
}

export interface SelfHealingActionResult {
  email: string;
  action: "RENEW_WATCH" | "RESYNC_CURSOR" | "REFRESH_TOKENS" | "NO_ACTION_NEEDED";
  success: boolean;
  message: string;
  newHistoryId?: string;
  newExpiresAt?: string;
}

// ── Google Cloud PubSub push payload ─────────────────────────────────────────

/**
 * Raw HTTP body delivered by Google Cloud PubSub to /api/webhooks/gmail.
 *
 * PubSub wraps all notifications in this envelope. The inner `data` field
 * is a base64-encoded JSON string containing the actual Gmail notification.
 *
 * Reference: https://cloud.google.com/pubsub/docs/push#receiving_messages
 */
export interface PubSubPushBody {
  message: {
    /** Base64-encoded JSON string — decode to get GmailPushNotification. */
    data: string;
    messageId: string;
    publishTime: string;
    attributes?: Record<string, string>;
  };
  subscription: string;
}

/**
 * Decoded content of PubSubPushBody.message.data after base64 decode + JSON parse.
 *
 * Gmail sends this for every mailbox change (new message, label change, etc.).
 * The historyId points to the start of new history; we fetch from our stored
 * cursor up to this ID.
 *
 * Reference: https://developers.google.com/gmail/api/guides/push#receiving_notifications
 */
export interface GmailPushNotification {
  /** The Gmail address that triggered this notification. */
  emailAddress: string;
  /**
   * The new historyId of the mailbox at the time of notification.
   * This is an upper bound — fetch history from our stored cursor up to here.
   */
  historyId: string;
}

// ── Gmail History API ─────────────────────────────────────────────────────────

/**
 * A single new inbound message extracted from a Gmail History diff.
 *
 * Only populated for messages that:
 *   1. Were added to the mailbox (not deleted, not label changes)
 *   2. Have the INBOX label (not SENT, DRAFT, SPAM, TRASH)
 *
 * We fetch minimal metadata here; full header resolution happens in the engine.
 */
export interface HistoryMessage {
  /** Gmail message ID (unique per message, globally). */
  id: string;
  /** Gmail thread ID — used to match against sequence_steps.gmail_thread_id. */
  threadId: string;
}

// ── Gmail Watch registration ──────────────────────────────────────────────────

/**
 * Data returned by gmail.users.watch() and persisted to GmailWatchState.
 *
 * The watch expires after at most 7 days. The system must renew it proactively
 * (via /api/gmail/watch) before expiration or fall back to the cron scanner.
 *
 * Reference: https://developers.google.com/gmail/api/reference/rest/v1/users/watch
 */
export interface WatchRegistration {
  /** Gmail address the watch is registered for. */
  emailAddress: string;
  /**
   * Unix timestamp in milliseconds when this watch expires.
   * Renew when: Date.now() > expiration - WATCH_RENEWAL_BUFFER_MS
   */
  expiration: bigint;
  /** The Google Cloud PubSub topic name used to receive notifications. */
  topicName: string;
  /**
   * The current historyId at registration time.
   * Stored as the initial cursor so we never fetch history older than the watch start.
   */
  historyId: string;
}

// ── Engine processing result ──────────────────────────────────────────────────

/**
 * Outcome for a single inbound message processed by the engine.
 */
export type MessageProcessingOutcome =
  | "REAL_REPLY"      // Classified as genuine reply — sequence stopped
  | "AUTO_REPLY"      // Automated response — ignored
  | "NEEDS_REVIEW"    // Uncertain — flagged for operator review
  | "SPAM"            // Spam pattern match — ignored
  | "NO_MATCH"        // threadId does not match any active sequence — skipped
  | "DUPLICATE"       // Already classified (idempotency) — skipped
  | "CONFIG_ERROR";   // OAuth or environment config missing — skipped

/**
 * Per-message result returned by the engine for observability.
 */
export interface MessageProcessingResult {
  gmailMessageId: string;
  gmailThreadId: string;
  outcome: MessageProcessingOutcome;
  /** Populated if matched — null when outcome is NO_MATCH or DUPLICATE. */
  sequenceId: string | null;
  prospectId: string | null;
  /** Human-readable reason for this outcome — for logs and dashboard. */
  detail: string;
}

/**
 * Complete result of processing one PubSub push notification.
 * Returned by engine.processPushNotification() and logged for observability.
 */
export interface NotificationProcessingResult {
  /** The Gmail address that received the notification. */
  emailAddress: string;
  /** Number of new inbound messages found in the history delta. */
  messagesFound: number;
  /** Per-message outcomes. */
  results: MessageProcessingResult[];
  /** ISO 8601 UTC — when processing started. */
  startedAt: string;
  /** ISO 8601 UTC — when processing finished. */
  finishedAt: string;
  durationMs: number;
  /** true if processing completed without unrecoverable errors. */
  success: boolean;
}

// ── Structured log events ─────────────────────────────────────────────────────

/**
 * All structured log event names emitted by the reply-tracker module.
 * Follows the same string-literal union pattern as GmailLogEvent and ReplyLogEvent.
 */
export type ReplyTrackerLogEvent =
  // Watch lifecycle
  | "tracker_watch_registered"
  | "tracker_watch_renewed"
  | "tracker_watch_expired"
  | "tracker_watch_error"
  // Multi-user & self healing
  | "tracker_auto_healed"
  | "tracker_health_alert"
  | "tracker_account_connected"
  | "tracker_account_disconnected"
  // Webhook ingestion
  | "tracker_webhook_received"
  | "tracker_webhook_invalid_payload"
  | "tracker_webhook_unauthorized"
  // Engine processing
  | "tracker_notification_processing_started"
  | "tracker_notification_processing_completed"
  | "tracker_history_fetched"
  | "tracker_history_cursor_invalid"   // historyId expired — full resync triggered
  | "tracker_history_cursor_advanced"
  | "tracker_message_no_match"
  | "tracker_message_duplicate"
  | "tracker_message_classified"
  | "tracker_message_real_reply"
  | "tracker_engine_error";
