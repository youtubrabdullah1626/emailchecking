/**
 * Gmail Reply Tracker — Gmail API Client
 *
 * All Gmail API interactions for the push-notification reply tracking system.
 * Single responsibility: talk to Google APIs. Never reads or writes the database.
 * Never contains reply classification or sequence business logic.
 *
 * APIs used:
 *   - gmail.users.watch()         — Register push notification subscription
 *   - gmail.users.stop()          — Deregister push notification subscription
 *   - gmail.users.getProfile()    — Get current historyId for cursor recovery
 *   - gmail.users.history.list()  — Fetch mailbox changes since a given historyId
 *   - gmail.users.messages.get()  — Fetch full message metadata (headers + snippet)
 *
 * Authentication:
 *   Reuses createOAuth2Client() from src/lib/gmail/oauth.ts.
 *   Access tokens are refreshed automatically via the stored refresh token.
 *   Never stores or logs tokens.
 *
 * Error handling:
 *   - Gmail API errors are caught and rethrown as typed GmailTrackerError
 *   - History ID expiration (HTTP 404) is detected and signalled via
 *     GmailTrackerError.code === 'HISTORY_EXPIRED' so the engine can recover
 *
 * Server-side only. Never import from client components.
 */

import { google } from "googleapis";
import { createOAuth2Client, getOAuthConfig } from "@/lib/gmail/oauth";
import type { InboundMessage } from "@/lib/reply/classifier";
import type { HistoryMessage, WatchRegistration } from "./types";
import {
  retryWithJitter,
  classifyError,
  isOAuthRevoked,
  markAccountNeedsReconnect,
  checkRateLimit,
  isCircuitOpen,
  recordCircuitFailure,
  resetCircuit,
} from "@/lib/reliability";

// ── Constants ─────────────────────────────────────────────────────────────────

/** Gmail label IDs that identify inbox messages (not sent, draft, trash, spam). */
const INBOX_LABEL_IDS = new Set(["INBOX"]);

// ── Error type ────────────────────────────────────────────────────────────────

/**
 * Typed error thrown by all functions in this module.
 * The `code` field allows callers to branch on specific failure modes
 * without string-matching error messages.
 */
export class GmailTrackerError extends Error {
  constructor(
    public readonly code:
      | "OAUTH_MISSING"      // env vars not configured
      | "HISTORY_EXPIRED"    // historyId too old — caller must resync cursor
      | "API_ERROR"          // unrecoverable Gmail API error
      | "INVALID_RESPONSE",  // Gmail returned unexpected shape
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "GmailTrackerError";
  }
}

// ── Gmail client factory & Reliability Engine integration ─────────────────────

/**
 * Backward-compatible re-export of the production retry helper.
 * All Gmail API calls use the reliability engine's jitter-based backoff.
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  initialDelayMs = 500
): Promise<T> {
  return retryWithJitter(fn, { maxRetries, initialDelayMs, jitter: true });
}

/**
 * Multi-User: Create an authenticated Gmail API client for a specific connected account.
 * Detects OAuth revocation (invalid_grant) and marks the account NEEDS_RECONNECT
 * so the self-healing engine stops hammering a revoked token.
 */
async function createGmailClient(email?: string) {
  try {
    const { createOAuth2ClientForAccount } = await import("@/lib/gmail/oauth");
    const auth = await createOAuth2ClientForAccount(email);
    
    return google.gmail({ version: "v1", auth: auth as any });
  } catch (err) {
    // Detect permanently revoked tokens — flag for reconnection, do not retry
    if (isOAuthRevoked(err) && email) {
      await markAccountNeedsReconnect(email, err instanceof Error ? err.message : "OAuth token revoked");
      throw new GmailTrackerError("OAUTH_MISSING", `OAuth token revoked for ${email}. Account flagged for reconnection.`, err);
    }
    const msg = err instanceof Error ? err.message : "OAuth error";
    throw new GmailTrackerError("OAUTH_MISSING", msg, err);
  }
}

/**
 * Rate-limit + circuit-breaker guard for a Gmail API operation.
 * Returns false if the circuit is open or quota is exhausted for this account.
 */
function canCallGmailApi(email: string): boolean {
  if (isCircuitOpen(email)) return false;
  if (!checkRateLimit(email)) return false;
  return true;
}

// ── Watch registration ────────────────────────────────────────────────────────

/**
 * Register a Gmail push notification watch for a specific connected mailbox.
 *
 * @param topicName - Full Google Cloud PubSub topic name.
 * @param email - Target connected email account.
 */
export async function registerGmailWatch(
  topicName: string,
  email?: string
): Promise<WatchRegistration> {
  const gmail = await createGmailClient(email);
  const targetEmail = email || process.env.GMAIL_SENDER_EMAIL || "me@example.com";

  let response;
  try {
    response = await retryWithBackoff(() =>
      gmail.users.watch({
        userId: "me",
        requestBody: {
          topicName,
          labelIds: ["INBOX"],
          labelFilterBehavior: "INCLUDE",
        },
      })
    );
  } catch (err) {
    throw new GmailTrackerError(
      "API_ERROR",
      `Failed to register Gmail watch for ${targetEmail}: ${safeErrorMessage(err)}`,
      err
    );
  }

  const { historyId, expiration } = response.data;

  if (!historyId || !expiration) {
    throw new GmailTrackerError(
      "INVALID_RESPONSE",
      `Gmail watch() returned incomplete data for ${targetEmail}: historyId=${historyId}, expiration=${expiration}`
    );
  }

  return {
    emailAddress: targetEmail,
    expiration: BigInt(expiration),
    topicName,
    historyId,
  };
}

/**
 * Stop the active Gmail push notification watch for an account.
 */
export async function stopGmailWatch(email?: string): Promise<void> {
  try {
    const gmail = await createGmailClient(email);
    await gmail.users.stop({ userId: "me" });
  } catch {
    // Non-fatal — watch may have already expired
  }
}

// ── Current historyId (cursor recovery) ──────────────────────────────────────

/**
 * Fetch the current historyId from a connected Gmail mailbox profile.
 */
export async function getCurrentHistoryId(email?: string): Promise<string> {
  const gmail = await createGmailClient(email);

  let profile;
  try {
    profile = await retryWithBackoff(() => gmail.users.getProfile({ userId: "me" }));
  } catch (err) {
    throw new GmailTrackerError(
      "API_ERROR",
      `Failed to fetch Gmail profile for ${email ?? "default"}: ${safeErrorMessage(err)}`,
      err
    );
  }

  const historyId = profile.data.historyId;
  if (!historyId) {
    throw new GmailTrackerError(
      "INVALID_RESPONSE",
      "Gmail getProfile() returned no historyId."
    );
  }

  return historyId;
}

// ── History fetching ──────────────────────────────────────────────────────────

/**
 * Fetch all new INBOX messages added since the given historyId for a specific email account.
 */
export async function getNewInboxMessages(
  startHistoryId: string,
  email?: string
): Promise<HistoryMessage[]> {
  const gmail = await createGmailClient(email);

  let response;
  try {
    response = await retryWithBackoff(() =>
      gmail.users.history.list({
        userId: "me",
        startHistoryId,
        historyTypes: ["messageAdded"],
        labelId: "INBOX",
      })
    );
  } catch (err) {
    if (isHistoryExpiredError(err)) {
      throw new GmailTrackerError(
        "HISTORY_EXPIRED",
        `Gmail history cursor has expired for ${email ?? "default"} (startHistoryId=${startHistoryId}). ` +
          "Engine must resync cursor via getCurrentHistoryId().",
        err
      );
    }
    throw new GmailTrackerError(
      "API_ERROR",
      `Failed to fetch Gmail history for ${email ?? "default"}: ${safeErrorMessage(err)}`,
      err
    );
  }

  const historyRecords = response.data.history ?? [];

  const messages: HistoryMessage[] = [];
  for (const record of historyRecords) {
    for (const added of record.messagesAdded ?? []) {
      const msg = added.message;
      if (!msg?.id || !msg?.threadId) continue;

      const labelIds = msg.labelIds ?? [];
      const isInbox = labelIds.some((l) => INBOX_LABEL_IDS.has(l));
      if (!isInbox) continue;

      messages.push({ id: msg.id, threadId: msg.threadId });
    }
  }

  return messages;
}

// ── Full message metadata ─────────────────────────────────────────────────────

/**
 * Fetch full metadata for a single Gmail message in a user's account.
 */
export async function getMessageMetadata(
  messageId: string,
  email?: string
): Promise<InboundMessage> {
  const gmail = await createGmailClient(email);

  let response;
  try {
    response = await retryWithBackoff(() =>
      gmail.users.messages.get({
        userId: "me",
        id: messageId,
        format: "metadata",
        metadataHeaders: [
          "From",
          "To",
          "Subject",
          "Auto-Submitted",
          "X-Auto-Response-Suppress",
          "X-Autoreply",
          "X-Autorespond",
          "Precedence",
        ],
      })
    );
  } catch (err) {
    throw new GmailTrackerError(
      "API_ERROR",
      `Failed to fetch message metadata for ${messageId} (${email ?? "default"}): ${safeErrorMessage(err)}`,
      err
    );
  }

  const msg = response.data;

  return {
    id: msg.id ?? messageId,
    threadId: msg.threadId ?? "",
    headers: (msg.payload?.headers ?? []).map((h) => ({
      name: h.name ?? "",
      value: h.value ?? "",
    })),
    snippet: msg.snippet ?? "",
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Detect whether a Gmail API error indicates the historyId has expired.
 * Gmail returns HTTP 404 with "Requested entity was not found" for expired cursors.
 */
function isHistoryExpiredError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  // googleapis wraps API errors with a `code` (HTTP status) field
  const code = (err as { code?: number }).code;
  if (code === 404) return true;
  // Some client versions surface this as a `status` field
  const status = (err as { status?: number }).status;
  return status === 404;
}

/**
 * Extract a safe, non-secret error message from a caught API error.
 * Strips any token-like strings before returning.
 */
function safeErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message
      .replace(/ya29\.[A-Za-z0-9._-]+/g, "[ACCESS_TOKEN_REDACTED]")
      .replace(/refresh_token=[^&\s]*/gi, "refresh_token=[REDACTED]")
      .slice(0, 400);
  }
  return "Unknown error";
}
