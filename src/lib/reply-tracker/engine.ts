/**
 * Gmail Reply Tracker — Processing Engine
 *
 * The core orchestrator for the push-notification reply tracking pipeline.
 *
 * Execution flow for each PubSub push notification:
 *   1. Load stored history cursor (repository.ts)
 *   2. Fetch Gmail History delta since cursor (gmail.ts)
 *   3. For each new inbound message:
 *      a. Idempotency check — skip if already classified (repository.ts)
 *      b. Thread match — skip if not one of our sequences (repository.ts)
 *      c. Fetch full message metadata (gmail.ts)
 *      d. Classify message (src/lib/reply/classifier.ts — existing pipeline)
 *      e. On REAL_REPLY: atomic sequence stop (src/lib/reply/stop.ts — existing)
 *   4. Advance history cursor (repository.ts)
 *   5. Return structured result for observability
 *
 * Error handling strategy:
 *   - HISTORY_EXPIRED: recover by fetching current profile historyId and
 *     advancing cursor. The cron scanner covers missed messages during the gap.
 *   - Per-message errors are non-fatal: log and continue to next message.
 *   - Watch expiration is detected but not recovered here — the /api/gmail/watch
 *     route handles registration and renewal.
 *
 * Integration:
 *   - Reuses classifyMessage() from src/lib/reply/classifier.ts (no duplication)
 *   - Reuses applyReplyStop() from src/lib/reply/stop.ts (no duplication)
 *   - Reuses structured logging style from src/lib/reply/logger.ts
 *
 * Server-side only. Never import from client components.
 */

import { classifyMessage } from "@/lib/reply/classifier";
import { applyReplyStop } from "@/lib/reply/stop";
import { recordNeedsReview } from "@/lib/reply/scanner";
import {
  getNewInboxMessages,
  getMessageMetadata,
  getCurrentHistoryId,
  GmailTrackerError,
} from "./gmail";
import { logger } from "@/lib/observability/logger";
import {
  getWatchState,
  isAlreadyClassified,
  getSequenceByThreadId,
  advanceHistoryCursor,
} from "./repository";
import type {
  GmailPushNotification,
  MessageProcessingResult,
  MessageProcessingOutcome,
  NotificationProcessingResult,
} from "./types";

// ── Structured logger (follows project convention) ────────────────────────────

export type ReplyTrackerLogEvent = string;

// The payload can just be a generic record
export interface TrackerLogPayload {
  emailAddress?: string;
  gmailMessageId?: string;
  gmailThreadId?: string;
  sequenceId?: string;
  prospectId?: string;
  prospectName?: string;
  outcome?: string;
  detail?: string;
  durationMs?: number;
  messagesFound?: number;
  historyId?: string;
  [key: string]: string | number | boolean | undefined;
}

function trackerLog(
  event: ReplyTrackerLogEvent,
  payload: TrackerLogPayload = {}
): void {
  const isError = String(event).includes("failed") || String(event).includes("error");
  if (isError) {
    logger.error(`Reply Tracker Event: ${event}`, payload);
  } else {
    logger.info(`Reply Tracker Event: ${event}`, payload);
  }
}

// ── Sender email (from environment — same variable used by the sender) ─────────

function getSenderEmail(): string {
  return process.env.GMAIL_SENDER_EMAIL ?? "";
}

// ── Main entry point ──────────────────────────────────────────────────────────

/**
 * Process one Gmail PubSub push notification end-to-end.
 *
 * This is called synchronously inside the webhook route handler.
 * The route returns 200 on success, 500 on transient failure (triggers PubSub retry).
 *
 * @param notification - Decoded GmailPushNotification from the PubSub payload.
 */
export async function processPushNotification(
  notification: GmailPushNotification
): Promise<NotificationProcessingResult> {
  const startedAt = new Date();
  const { emailAddress, historyId: incomingHistoryId } = notification;

  trackerLog("tracker_notification_processing_started", {
    emailAddress,
    historyId: incomingHistoryId,
  });

  const results: MessageProcessingResult[] = [];

  // ── 1. Load stored history cursor ─────────────────────────────────────────
  const watchState = await getWatchState(emailAddress);
  if (!watchState) {
    // No watch state means no watch has been registered for this email.
    // This should not happen in normal operation — log and return early.
    trackerLog("tracker_engine_error", {
      emailAddress,
      detail: "No watch state found for email. Has /api/gmail/watch been called?",
    });
    return buildResult(emailAddress, startedAt, results, false);
  }

  const storedHistoryId = watchState.historyId;

  // ── 2. Fetch Gmail History delta ──────────────────────────────────────────
  let newMessages;
  try {
    newMessages = await getNewInboxMessages(storedHistoryId, emailAddress);
  } catch (err) {
    if (
      err instanceof GmailTrackerError &&
      err.code === "HISTORY_EXPIRED"
    ) {
      // Automatic Self-Healing: The stored cursor is too old.
      // Recover by advancing to the current profile historyId for this user account.
      trackerLog("tracker_history_cursor_invalid", {
        emailAddress,
        historyId: storedHistoryId,
        detail: "History cursor expired. Initiating automatic self-healing resync.",
      });
      try {
        const currentId = await getCurrentHistoryId(emailAddress);
        await advanceHistoryCursor(emailAddress, currentId);
        trackerLog("tracker_auto_healed", {
          emailAddress,
          newHistoryId: currentId,
          detail: "Successfully auto-healed history cursor.",
        });
      } catch {
        // If recovery fails, PubSub will retry
      }
      return buildResult(emailAddress, startedAt, results, false);
    }

    trackerLog("tracker_engine_error", {
      emailAddress,
      detail: `Failed to fetch Gmail history for ${emailAddress}: ${err instanceof Error ? err.message : "Unknown"}`,
    });
    return buildResult(emailAddress, startedAt, results, false);
  }

  trackerLog("tracker_history_fetched", {
    emailAddress,
    historyId: storedHistoryId,
    messagesFound: newMessages.length,
  });

  // ── 3. Process each new inbound message ───────────────────────────────────
  for (const historyMsg of newMessages) {
    const result = await processOneMessage(
      historyMsg.id,
      historyMsg.threadId,
      emailAddress
    );
    results.push(result);
  }

  // ── 4. Advance history cursor ─────────────────────────────────────────────
  // Use the higher of stored vs incoming historyId.
  // Gmail historyIds are monotonically increasing, so the incoming one from
  // the push notification is always >= the stored one.
  const newCursor =
    BigInt(incomingHistoryId) > BigInt(storedHistoryId)
      ? incomingHistoryId
      : storedHistoryId;

  try {
    await advanceHistoryCursor(emailAddress, newCursor);
    trackerLog("tracker_history_cursor_advanced", {
      emailAddress,
      historyId: newCursor,
    });
  } catch (err) {
    // Non-fatal: cursor advance failure means next run re-processes some messages,
    // which is safe because isAlreadyClassified() provides idempotency.
    trackerLog("tracker_engine_error", {
      emailAddress,
      detail: `Failed to advance history cursor: ${err instanceof Error ? err.message : "Unknown"}`,
    });
  }

  const finalResult = buildResult(emailAddress, startedAt, results, true);

  trackerLog("tracker_notification_processing_completed", {
    emailAddress,
    messagesFound: results.length,
    durationMs: finalResult.durationMs,
  });

  return finalResult;
}

// ── Per-message processor ─────────────────────────────────────────────────────

async function processOneMessage(
  gmailMessageId: string,
  gmailThreadId: string,
  senderEmail: string
): Promise<MessageProcessingResult> {
  // ── a. Idempotency check ──────────────────────────────────────────────────
  let alreadyDone: boolean;
  try {
    alreadyDone = await isAlreadyClassified(gmailMessageId);
  } catch {
    // DB unavailable — treat as duplicate to avoid partial processing
    return makeResult(gmailMessageId, gmailThreadId, "DUPLICATE", null, null,
      "DB unavailable for idempotency check — skipping safely."
    );
  }

  if (alreadyDone) {
    trackerLog("tracker_message_duplicate", { gmailMessageId, gmailThreadId });
    return makeResult(gmailMessageId, gmailThreadId, "DUPLICATE", null, null,
      "Message already classified — idempotent skip."
    );
  }

  // ── b. Thread → Sequence match ────────────────────────────────────────────
  let sequenceMatch: Awaited<ReturnType<typeof getSequenceByThreadId>>;
  try {
    sequenceMatch = await getSequenceByThreadId(gmailThreadId);
  } catch {
    return makeResult(gmailMessageId, gmailThreadId, "NO_MATCH", null, null,
      "DB unavailable for thread match — skipping."
    );
  }

  if (!sequenceMatch) {
    trackerLog("tracker_message_no_match", { gmailMessageId, gmailThreadId });
    return makeResult(gmailMessageId, gmailThreadId, "NO_MATCH", null, null,
      "Thread does not match any tracked sequence — not our campaign email."
    );
  }

  const { sequenceId, prospectId, prospectName, prospectEmail } = sequenceMatch;

  // ── c. Fetch full message metadata ────────────────────────────────────────
  let inboundMessage;
  try {
    inboundMessage = await getMessageMetadata(gmailMessageId, senderEmail);
  } catch (err) {
    const detail = err instanceof GmailTrackerError
      ? err.message
      : "Failed to fetch message metadata.";
    trackerLog("tracker_engine_error", {
      gmailMessageId,
      gmailThreadId,
      sequenceId,
      prospectId,
      detail,
    });
    return makeResult(gmailMessageId, gmailThreadId, "NO_MATCH",
      sequenceId, prospectId,
      `Gmail API error: ${detail}`
    );
  }

  // ── d. Classify message ───────────────────────────────────────────────────
  const classification = classifyMessage(inboundMessage, senderEmail, prospectEmail);

  trackerLog("tracker_message_classified", {
    gmailMessageId,
    gmailThreadId,
    sequenceId,
    prospectId,
    prospectName,
    outcome: classification.replyType,
    detail: classification.reason,
  });

  const outcome = classification.replyType as MessageProcessingOutcome;

  // ── e. Apply stop logic on confirmed real reply ───────────────────────────
  if (classification.replyType === "REAL_REPLY") {
    trackerLog("tracker_message_real_reply", {
      gmailMessageId,
      gmailThreadId,
      sequenceId,
      prospectId,
      prospectName,
      detail: classification.reason,
    });

    try {
      await applyReplyStop(sequenceId, prospectId, classification);
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Unknown stop error";
      trackerLog("tracker_engine_error", {
        gmailMessageId,
        gmailThreadId,
        sequenceId,
        prospectId,
        detail: `applyReplyStop failed: ${detail}`,
      });
    }
  } else if (classification.replyType === "NEEDS_REVIEW") {
    try {
      await recordNeedsReview(prospectId, classification, prospectEmail, prospectName);
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Unknown review error";
      trackerLog("tracker_engine_error", {
        gmailMessageId,
        gmailThreadId,
        sequenceId,
        prospectId,
        detail: `recordNeedsReview failed: ${detail}`,
      });
    }
  }

  return makeResult(
    gmailMessageId,
    gmailThreadId,
    outcome,
    sequenceId,
    prospectId,
    classification.reason
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeResult(
  gmailMessageId: string,
  gmailThreadId: string,
  outcome: MessageProcessingOutcome,
  sequenceId: string | null,
  prospectId: string | null,
  detail: string
): MessageProcessingResult {
  return { gmailMessageId, gmailThreadId, outcome, sequenceId, prospectId, detail };
}

function buildResult(
  emailAddress: string,
  startedAt: Date,
  results: MessageProcessingResult[],
  success: boolean
): NotificationProcessingResult {
  const finishedAt = new Date();
  return {
    emailAddress,
    messagesFound: results.length,
    results,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    success,
  };
}
