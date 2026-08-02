/**
 * Gmail Reply Tracker — Health Monitor & Automatic Self-Healing Engine
 *
 * Smart Feature 1 (Automatic Self-Healing) & Smart Feature 2 (Connection Health Monitor)
 *
 * Single responsibility: Monitor mailbox connection health across thousands of SaaS accounts
 * and perform automated self-healing repairs before operators or users notice issues.
 *
 * Health Status States:
 *   - HEALTHY            → Active watch, valid cursor, OAuth tokens working
 *   - SYNCING            → In the middle of history delta sync
 *   - EXPIRING_SOON      → Watch expires in < 24 hours (triggers proactive renewal)
 *   - EXPIRED            → Watch expired (triggers auto-healing re-registration)
 *   - NEEDS_RECONNECT    → OAuth refresh token missing/revoked (user notification required)
 *   - DISCONNECTED       → Unlinked by user
 *
 * Self-Healing Capabilities:
 *   1. Proactive Watch Renewal (24h buffer before 7-day Watch expiry)
 *   2. History Cursor Auto-Resync (recovers invalid historyId via getCurrentHistoryId)
 *   3. Error Counter Reset & Auto-Healing Audit Logging
 *   4. System-wide background health sweep
 *
 * Server-side only. Never import from client components.
 */

import prisma from "@/lib/prisma";
import {
  registerGmailWatch,
  getCurrentHistoryId,
  stopGmailWatch,
  GmailTrackerError,
} from "./gmail";
import {
  saveWatchState,
  getWatchState,
  advanceHistoryCursor,
} from "./repository";
import type {
  AccountHealthStatus,
  AccountHealthSummary,
  SelfHealingActionResult,
} from "./types";

// 24-hour buffer for proactive watch renewal before expiration
const WATCH_RENEWAL_BUFFER_MS = 24 * 60 * 60 * 1000;

// ── Health Status Evaluation ──────────────────────────────────────────────────

/**
 * Compute real-time connection health summary for a specific connected Gmail account.
 */
export async function getAccountHealthSummary(
  email: string
): Promise<AccountHealthSummary> {
  const [account, watchState] = await Promise.all([
    prisma.emailAccount.findUnique({ where: { email } }),
    getWatchState(email),
  ]);

  const hasRefreshToken = !!(
    account?.refresh_token || process.env.GMAIL_REFRESH_TOKEN
  );
  const connectionStatus = account?.connection_status ?? "CONNECTED";

  if (connectionStatus === "DISCONNECTED") {
    return buildSummary(
      email,
      account?.user_id ?? null,
      "DISCONNECTED",
      "DISCONNECTED",
      watchState,
      hasRefreshToken
    );
  }

  if (!hasRefreshToken) {
    return buildSummary(
      email,
      account?.user_id ?? null,
      "NEEDS_RECONNECT",
      "NEEDS_RECONNECT",
      watchState,
      false
    );
  }

  if (!watchState) {
    return buildSummary(
      email,
      account?.user_id ?? null,
      connectionStatus,
      "EXPIRED",
      null,
      hasRefreshToken
    );
  }

  const expirationMs = Number(watchState.expiration);
  const nowMs = Date.now();
  const msUntilExpiry = expirationMs - nowMs;

  let healthStatus: AccountHealthStatus = "HEALTHY";

  if (msUntilExpiry <= 0) {
    healthStatus = "EXPIRED";
  } else if (msUntilExpiry < WATCH_RENEWAL_BUFFER_MS) {
    healthStatus = "EXPIRING_SOON";
  }

  return buildSummary(
    email,
    account?.user_id ?? null,
    connectionStatus,
    healthStatus,
    watchState,
    hasRefreshToken
  );
}

/**
 * List connection health summaries across all connected email accounts in the SaaS.
 */
export async function listAllAccountHealth(): Promise<AccountHealthSummary[]> {
  const accounts = await prisma.emailAccount.findMany({
    select: { email: true },
  });

  const watchStates = await prisma.gmailWatchState.findMany({
    select: { email: true },
  });

  // Unique set of all emails in email_accounts or gmail_watch_state
  const allEmails = Array.from(
    new Set([
      ...accounts.map((a) => a.email),
      ...watchStates.map((w) => w.email),
      ...(process.env.GMAIL_SENDER_EMAIL ? [process.env.GMAIL_SENDER_EMAIL] : []),
    ])
  );

  return Promise.all(allEmails.map((email) => getAccountHealthSummary(email)));
}

// ── Automatic Self-Healing Engine ──────────────────────────────────────────────

/**
 * Perform automated self-healing repair on a connected Gmail account.
 *
 * Triggered automatically by health sweeps, webhook errors, or manual repair requests.
 *
 * Self-healing steps:
 *   1. If watch is missing, expiring soon, or expired → renew watch via registerGmailWatch
 *   2. If historyId is invalid → resync cursor via getCurrentHistoryId
 *   3. Reset error count and update auto_healed_at timestamp in database
 */
export async function autoRepairAccount(
  email: string
): Promise<SelfHealingActionResult> {
  const summary = await getAccountHealthSummary(email);
  const topicName =
    process.env.GMAIL_PUBSUB_TOPIC ||
    `projects/${process.env.GCP_PROJECT_ID || "youtube-drive-workflow"}/topics/gmail-replies`;

  if (!summary.hasRefreshToken) {
    return {
      email,
      action: "REFRESH_TOKENS",
      success: false,
      message: "Cannot auto-heal: OAuth refresh token is missing. User must reconnect Gmail.",
    };
  }

  // 1. Proactive Watch Renewal or Expiration Re-registration
  if (
    summary.healthStatus === "EXPIRED" ||
    summary.healthStatus === "EXPIRING_SOON" ||
    !summary.historyId
  ) {
    try {
      await stopGmailWatch(email);
      const registration = await registerGmailWatch(topicName, email);
      await saveWatchState(registration);

      await prisma.gmailWatchState.updateMany({
        where: { email },
        data: {
          health_status: "HEALTHY",
          error_count: 0,
          last_error: null,
          auto_healed_at: new Date(),
        },
      });

      return {
        email,
        action: "RENEW_WATCH",
        success: true,
        message: "Watch subscription successfully renewed and persisted.",
        newHistoryId: registration.historyId,
        newExpiresAt: new Date(Number(registration.expiration)).toISOString(),
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Watch registration error";
      await recordHealthError(email, msg);
      return {
        email,
        action: "RENEW_WATCH",
        success: false,
        message: `Self-healing watch renewal failed: ${msg}`,
      };
    }
  }

  // 2. Cursor Resync (if cursor expired)
  try {
    const currentHistoryId = await getCurrentHistoryId(email);
    await advanceHistoryCursor(email, currentHistoryId);

    await prisma.gmailWatchState.updateMany({
      where: { email },
      data: {
        health_status: "HEALTHY",
        error_count: 0,
        last_error: null,
        auto_healed_at: new Date(),
      },
    });

    return {
      email,
      action: "RESYNC_CURSOR",
      success: true,
      message: `History cursor resynced to current historyId ${currentHistoryId}.`,
      newHistoryId: currentHistoryId,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Cursor resync error";
    await recordHealthError(email, msg);
    return {
      email,
      action: "RESYNC_CURSOR",
      success: false,
      message: `Self-healing cursor resync failed: ${msg}`,
    };
  }
}

/**
 * System-wide Self-Healing Sweep: Scans all connected accounts and auto-repairs any
 * accounts that are EXPIRED or EXPIRING_SOON.
 *
 * Intended to run automatically via cron (e.g. daily at 06:00 UTC).
 */
export async function runSystemWideSelfHealing(): Promise<SelfHealingActionResult[]> {
  const summaries = await listAllAccountHealth();
  const needingRepair = summaries.filter(
    (s) =>
      s.healthStatus === "EXPIRED" ||
      s.healthStatus === "EXPIRING_SOON" ||
      s.needsWatchRenewal
  );

  const results: SelfHealingActionResult[] = [];
  for (const acc of needingRepair) {
    const res = await autoRepairAccount(acc.email);
    results.push(res);
  }

  return results;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildSummary(
  email: string,
  userId: string | null,
  connectionStatus: string,
  healthStatus: AccountHealthStatus,
  watchState: { historyId: string; expiration: bigint; registeredAt: Date } | null,
  hasRefreshToken: boolean
): AccountHealthSummary {
  const expirationMs = watchState ? Number(watchState.expiration) : null;
  const msUntilExpiry = expirationMs ? expirationMs - Date.now() : null;
  const expiresAt = expirationMs ? new Date(expirationMs).toISOString() : null;

  return {
    email,
    userId,
    connectionStatus,
    healthStatus,
    historyId: watchState?.historyId ?? null,
    expiresAt,
    msUntilExpiry,
    needsWatchRenewal: msUntilExpiry ? msUntilExpiry < WATCH_RENEWAL_BUFFER_MS : true,
    errorCount: 0,
    lastError: null,
    lastSyncedAt: watchState?.registeredAt ? watchState.registeredAt.toISOString() : null,
    autoHealedAt: null,
    hasRefreshToken,
  };
}

async function recordHealthError(email: string, errorMsg: string): Promise<void> {
  try {
    await prisma.gmailWatchState.updateMany({
      where: { email },
      data: {
        error_count: { increment: 1 },
        last_error: errorMsg.slice(0, 500),
        health_status: "NEEDS_RECONNECT",
      },
    });
  } catch {
    // Non-fatal logging
  }
}
