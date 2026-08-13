/**
 * Reply Scanner — Gmail Thread Inspection and Orchestration
 *
 * Queries all active sequences that have sent at least one email (gmail_thread_id
 * is set on at least one step), then for each thread:
 *
 *   1. Fetches the full thread from Gmail API — using the OWNER ACCOUNT'S credentials
 *   2. Filters for inbound messages only (not our own sends)
 *   3. Skips messages already classified (deduplication via DB lookup)
 *   4. Classifies each inbound message
 *   5. Applies stop logic if the most actionable classification is REAL_REPLY
 *   6. Records NEEDS_REVIEW classifications without stopping
 *
 * MULTI-TENANT FIX:
 *   Previously, a single global OAuth client (owner's GMAIL_REFRESH_TOKEN) was used
 *   for ALL users' threads, causing silent 404 failures for any non-owner user.
 *   Now, threads are grouped by user_id. For each user, we look up their connected
 *   EmailAccount and call createOAuth2ClientForAccount(email) to get a correctly
 *   scoped OAuth client. Only threads whose user has a CONNECTED email account are
 *   scanned — threads with no connected account are logged and skipped gracefully.
 *
 * BUG FIX — All unique thread IDs per sequence:
 *   Previously only steps[0].gmail_thread_id was used. Now ALL unique thread IDs
 *   across all steps are deduplicated and checked, covering multi-thread sequences.
 *
 * Design:
 *   - Processes threads sequentially per user to avoid Gmail rate-limit spikes
 *   - Conservative: never stops on NEEDS_REVIEW or AUTO_REPLY
 *   - Idempotent: already-stopped sequences are detected and skipped
 *   - OAuth scope required: gmail.readonly
 *
 * Server-side only. Never import from client components.
 */

import { google } from "googleapis";
import prisma from "@/lib/prisma";
import { getOAuthConfig } from "@/lib/gmail/oauth";
import { classifyMessage, mostActionableClassification } from "./classifier";
import { applyReplyStop } from "./stop";
import { replyLog } from "./logger";
import { evaluateIntelligencePolicy } from "@/lib/intelligence/policy";
import type {
  ScanResult,
  ThreadScanResult,
  ThreadScanOutcome,
  ClassificationResult,
} from "./types";
import type { InboundMessage } from "./classifier";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ActiveThread {
  gmailThreadId: string;
  sequenceId: string;
  prospectId: string;
  prospectName: string;
  prospectEmail: string;
  userId: string;
  ourMessageIds: Set<string>;
}

// ── Main scan function ────────────────────────────────────────────────────────

/**
 * Scan all active sequences for replies.
 * Groups threads by user, obtains per-user Gmail credentials, scans each thread.
 * Returns a structured ScanResult with per-thread outcomes.
 */
export async function scanForReplies(): Promise<ScanResult> {
  const startedAt = new Date();
  replyLog("reply_scan_started", {});

  // ── 1. Validate base OAuth config (client ID + secret must exist) ──────────
  const config = getOAuthConfig();
  if (!config) {
    replyLog("reply_oauth_missing", {
      detail: "GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, or GMAIL_SENDER_EMAIL missing.",
    });
    return buildScanResult(startedAt, [], "CONFIG_ERROR");
  }

  // ── 2. Load all active threads with their owning user_id ──────────────────
  let activeThreads: ActiveThread[];
  try {
    activeThreads = await loadActiveThreads();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "DB error";
    replyLog("reply_scan_error", { detail: `Failed to load active threads: ${msg}` });
    return buildScanResult(startedAt, [], "FAILED");
  }

  replyLog("reply_scan_thread_found", { threadsScanned: activeThreads.length });

  if (activeThreads.length === 0) {
    return buildScanResult(startedAt, [], "SUCCESS");
  }

  // ── 3. Group threads by user_id ───────────────────────────────────────────
  const threadsByUser = new Map<string, ActiveThread[]>();
  for (const thread of activeThreads) {
    const existing = threadsByUser.get(thread.userId) ?? [];
    existing.push(thread);
    threadsByUser.set(thread.userId, existing);
  }

  // ── 4. For each user, resolve their Gmail account and scan ────────────────
  const results: ThreadScanResult[] = [];

  for (const [userId, userThreads] of threadsByUser) {
    // Look up the user's CONNECTED email account for OAuth credentials
    const emailAccount = await prisma.emailAccount.findFirst({
      where: {
        user_id: userId,
        connection_status: "CONNECTED",
        refresh_token: { not: null },
      },
      select: { email: true },
      orderBy: { created_at: "asc" }, // use earliest connected account if multiple
    });

    if (!emailAccount) {
      // No connected account for this user — log and skip gracefully
      replyLog("reply_scan_no_account", {
        userId,
        detail: `User ${userId} has no CONNECTED email account. Skipping ${userThreads.length} thread(s).`,
      });
      for (const thread of userThreads) {
        results.push({
          sequenceId: thread.sequenceId,
          prospectId: thread.prospectId,
          prospectName: thread.prospectName,
          gmailThreadId: thread.gmailThreadId,
          outcome: "ERROR",
          detail: "No connected Gmail account for this user.",
        });
      }
      continue;
    }

    // Create a correctly scoped OAuth client for this specific Gmail account.
    // createOAuth2ClientForAccount() reads the refresh_token from EmailAccount
    // in the DB — not from the global env var. This is the core multi-tenant fix.
    let auth: any;
    try {
      const { createOAuth2ClientForAccount } = await import("@/lib/gmail/oauth");
      auth = await createOAuth2ClientForAccount(emailAccount.email);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "OAuth error";
      replyLog("reply_scan_error", {
        userId,
        accountEmail: emailAccount.email,
        detail: `Failed to create OAuth client: ${msg}`,
      });
      for (const thread of userThreads) {
        results.push({
          sequenceId: thread.sequenceId,
          prospectId: thread.prospectId,
          prospectName: thread.prospectName,
          gmailThreadId: thread.gmailThreadId,
          outcome: "ERROR",
          detail: `OAuth client error for account ${emailAccount.email}: ${msg}`,
        });
      }
      continue;
    }

    // Scan each thread for this user using their correct account's auth
    for (const thread of userThreads) {
      const result = await scanThread(thread, emailAccount.email, auth);
      results.push(result);
    }
  }

  const finishedAt = new Date();
  const durationMs = finishedAt.getTime() - startedAt.getTime();

  const errorCount = results.filter((r) => r.outcome === "ERROR").length;
  const status =
    errorCount === 0
      ? "SUCCESS"
      : errorCount < results.length
      ? "PARTIAL_FAILURE"
      : "FAILED";

  const scanResult = buildScanResult(startedAt, results, status);

  replyLog("reply_processing_completed", {
    threadsScanned: results.length,
    durationMs,
    status,
  });

  return { ...scanResult, finishedAt: new Date().toISOString(), durationMs };
}

// ── Per-thread scan ───────────────────────────────────────────────────────────

async function scanThread(
  thread: ActiveThread,
  senderEmail: string,
  auth: any
): Promise<ThreadScanResult> {
  const { gmailThreadId, sequenceId, prospectId, prospectName, prospectEmail } = thread;

  replyLog("reply_thread_matched", {
    gmailThreadId,
    sequenceId,
    prospectId,
    prospectName,
  });

  // Check if sequence is already stopped (pre-scan idempotency check)
  try {
    const seq = await prisma.sequence.findUnique({
      where: { id: sequenceId },
      select: { status: true },
    });
    if (seq && seq.status === "STOPPED") {
      return {
        sequenceId,
        prospectId,
        prospectName,
        gmailThreadId,
        outcome: "ALREADY_STOPPED",
        detail: `Sequence is already ${seq.status} — skipped.`,
      };
    }
  } catch {
    // Non-fatal — proceed with scan
  }

  // Fetch the Gmail thread using the correct account's auth
  let gmailMessages: InboundMessage[];
  try {
    gmailMessages = await fetchThreadMessages(gmailThreadId, auth);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Gmail API error";
    replyLog("reply_scan_error", {
      gmailThreadId,
      sequenceId,
      prospectId,
      detail: `Failed to fetch thread: ${msg}`,
    });
    return {
      sequenceId,
      prospectId,
      prospectName,
      gmailThreadId,
      outcome: "ERROR",
      detail: `Gmail thread fetch failed: ${msg}`,
    };
  }

  // Get already-classified message IDs to skip duplicates
  const alreadyClassifiedIds = await getClassifiedMessageIds(gmailThreadId);

  // Filter: only inbound messages (not from us), not already classified
  const inboundMessages = gmailMessages.filter((msg) => {
    const fromHeader = msg.headers.find((h) => h.name.toLowerCase() === "from")?.value ?? "";
    const fromEmail = extractEmailAddressSimple(fromHeader);
    const isFromProspect = fromEmail.toLowerCase() === prospectEmail.toLowerCase();

    // Skip our own system-sent messages (initial emails, follow-ups)
    if (thread.ourMessageIds.has(msg.id)) {
      replyLog("reply_message_skipped_system_outbound", { gmailThreadId, gmailMessageId: msg.id });
      return false;
    }

    // Skip our own manual sent messages
    if (fromEmail.toLowerCase() === senderEmail.toLowerCase() && !isFromProspect) {
      if (process.env.LIVE_TEST_OVERRIDE === "true" && msg.snippet.toLowerCase().includes("simulated reply")) {
        // Allow the simulated reply to pass through for integration testing
      } else {
        replyLog("reply_message_skipped_own", { gmailThreadId, gmailMessageId: msg.id });
        return false;
      }
    }

    // Skip already-classified messages
    if (alreadyClassifiedIds.has(msg.id)) {
      replyLog("reply_message_skipped_duplicate", { gmailThreadId, gmailMessageId: msg.id });
      return false;
    }

    return true;
  });

  if (inboundMessages.length === 0) {
    return {
      sequenceId,
      prospectId,
      prospectName,
      gmailThreadId,
      outcome: "NO_REPLIES",
      detail: "No new inbound messages found in thread.",
    };
  }

  // Classify all inbound messages
  const classifications = inboundMessages.map((msg) =>
    classifyMessage(msg, senderEmail, prospectEmail)
  );

  // Pick the most actionable classification
  const best = mostActionableClassification(classifications);
  if (!best) {
    return {
      sequenceId,
      prospectId,
      prospectName,
      gmailThreadId,
      outcome: "NO_REPLIES",
      detail: "No actionable messages after classification.",
    };
  }

  let outcome: ThreadScanOutcome;

  switch (best.replyType) {
    case "REAL_REPLY": {
      replyLog("reply_classified_real", {
        gmailThreadId,
        gmailMessageId: best.gmailMessageId,
        sequenceId,
        prospectId,
        prospectName,
        fromEmail: best.fromEmail,
        subject: best.subject,
        reason: best.reason,
      });

      try {
        await applyReplyStop(sequenceId, prospectId, best);
        outcome = "REAL_REPLY";
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Stop error";
        replyLog("reply_scan_error", {
          sequenceId,
          prospectId,
          gmailThreadId,
          detail: `Stop action failed: ${msg}`,
        });
        outcome = "ERROR";
      }
      break;
    }

    case "AUTO_REPLY": {
      replyLog("reply_classified_auto", {
        gmailThreadId,
        gmailMessageId: best.gmailMessageId,
        sequenceId,
        prospectId,
        prospectName,
        reason: best.reason,
      });
      outcome = "AUTO_REPLY";
      break;
    }

    case "NEEDS_REVIEW": {
      replyLog("reply_classified_review", {
        gmailThreadId,
        gmailMessageId: best.gmailMessageId,
        sequenceId,
        prospectId,
        prospectName,
        reason: best.reason,
      });

      try {
        await recordNeedsReview(prospectId, best, prospectEmail, prospectName);
      } catch {
        // Non-fatal — classification record is advisory only
      }
      outcome = "NEEDS_REVIEW";
      break;
    }

    default: {
      outcome = "NO_REPLIES";
    }
  }

  return {
    sequenceId,
    prospectId,
    prospectName,
    gmailThreadId,
    outcome,
    classification: best,
    detail: best.reason,
  };
}

// ── Data loading ──────────────────────────────────────────────────────────────

/**
 * Load all ACTIVE/COMPLETED sequences that have at least one step with a
 * gmail_thread_id. Returns ALL unique thread IDs per sequence (not just the first).
 *
 * MULTI-TENANT FIX: user_id is now included so threads can be grouped by user
 * for per-account OAuth client selection.
 */
async function loadActiveThreads(): Promise<ActiveThread[]> {
  const sequences = await prisma.sequence.findMany({
    where: {
      status: { in: ["ACTIVE", "COMPLETED"] },
      steps: {
        some: { gmail_thread_id: { not: null } },
      },
    },
    select: {
      id: true,
      user_id: true,
      prospect: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      steps: {
        where: { gmail_thread_id: { not: null } },
        orderBy: { step_number: "asc" },
        select: { gmail_thread_id: true, gmail_message_id: true },
      },
    },
  });

  const threads: ActiveThread[] = [];

  for (const s of sequences) {
    // BUG FIX: Collect ALL unique thread IDs — not just steps[0]
    // Multiple steps may share the same thread (follow-ups) or have distinct
    // thread IDs (rare). Deduplicating ensures we check each unique thread once.
    const seenThreadIds = new Set<string>();
    const ourMessageIds = new Set(
      s.steps.map((step) => step.gmail_message_id).filter((id): id is string => id !== null)
    );

    for (const step of s.steps) {
      const tid = step.gmail_thread_id!;
      if (seenThreadIds.has(tid)) continue;
      seenThreadIds.add(tid);

      threads.push({
        gmailThreadId: tid,
        sequenceId: s.id,
        prospectId: s.prospect.id,
        prospectName: s.prospect.name,
        prospectEmail: s.prospect.email,
        userId: s.user_id,
        ourMessageIds,
      });
    }
  }

  return threads;
}

/**
 * Fetch all messages in a Gmail thread using the provided per-account auth.
 */
async function fetchThreadMessages(
  threadId: string,
  auth: any
): Promise<InboundMessage[]> {
  const gmail = google.gmail({ version: "v1", auth });

  const response = await gmail.users.threads.get({
    userId: "me",
    id: threadId,
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
  });

  const messages = response.data.messages ?? [];

  return messages.map((msg) => ({
    id: msg.id ?? "",
    threadId: msg.threadId ?? threadId,
    headers: (msg.payload?.headers ?? []).map((h) => ({
      name: h.name ?? "",
      value: h.value ?? "",
    })),
    snippet: msg.snippet ?? "",
  }));
}

/**
 * Get the set of Gmail message IDs already in reply_classifications for a thread.
 * Used to skip duplicate classification.
 */
async function getClassifiedMessageIds(gmailThreadId: string): Promise<Set<string>> {
  const existing = await prisma.replyClassification.findMany({
    where: { gmail_thread_id: gmailThreadId },
    select: { gmail_message_id: true },
  });
  return new Set(existing.map((r) => r.gmail_message_id));
}

/**
 * Record a NEEDS_REVIEW classification with intelligence policy analysis.
 */
export async function recordNeedsReview(
  prospectId: string,
  classification: ClassificationResult,
  prospectEmail: string,
  prospectName: string
): Promise<void> {
  try {
    const policyResult = await evaluateIntelligencePolicy(
      {
        gmailMessageId: classification.gmailMessageId,
        gmailThreadId: classification.gmailThreadId,
        senderEmail: classification.fromEmail,
        prospectEmail,
        prospectName,
        prospectCompany: "",
        subject: classification.subject,
        snippet: classification.snippet,
        deterministicSignals: [classification.reason],
      },
      classification
    );

    await prisma.replyClassification.upsert({
      where: { gmail_message_id: classification.gmailMessageId },
      create: {
        prospect_id: prospectId,
        gmail_thread_id: classification.gmailThreadId,
        gmail_message_id: classification.gmailMessageId,
        reply_type: "NEEDS_REVIEW",
        confidence: policyResult.confidence,
        reason: policyResult.reason,
        recommended_action: policyResult.recommendedAction,
        signals: policyResult.signals,
        review_status: "PENDING",
        raw_snippet: classification.snippet || null,
      },
      update: {
        confidence: policyResult.confidence,
        reason: policyResult.reason,
        recommended_action: policyResult.recommendedAction,
        signals: policyResult.signals,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Upsert error";
    replyLog("intelligence_analysis_failed", {
      gmailMessageId: classification.gmailMessageId,
      detail: `Failed to record intelligence review: ${msg}`,
    });
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildScanResult(
  startedAt: Date,
  results: ThreadScanResult[],
  status: ScanResult["status"]
): ScanResult {
  return {
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    durationMs: new Date().getTime() - startedAt.getTime(),
    threadsScanned: results.length,
    noReplies: results.filter((r) => r.outcome === "NO_REPLIES").length,
    autoReplies: results.filter((r) => r.outcome === "AUTO_REPLY").length,
    needsReview: results.filter((r) => r.outcome === "NEEDS_REVIEW").length,
    realReplies: results.filter((r) => r.outcome === "REAL_REPLY").length,
    alreadyStopped: results.filter((r) => r.outcome === "ALREADY_STOPPED").length,
    errors: results.filter((r) => r.outcome === "ERROR").length,
    results,
    status,
  };
}

function extractEmailAddressSimple(fromHeader: string): string {
  const angleMatch = fromHeader.match(/<([^>]+)>/);
  if (angleMatch) return angleMatch[1].trim();
  return fromHeader.trim();
}
