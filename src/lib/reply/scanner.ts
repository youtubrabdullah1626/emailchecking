/**
 * Reply Scanner — Gmail Thread Inspection and Orchestration
 *
 * Queries all active sequences that have sent at least one email (gmail_thread_id
 * is set on at least one step), then for each thread:
 *
 *   1. Fetches the full thread from Gmail API
 *   2. Filters for inbound messages only (not our own sends)
 *   3. Skips messages already classified (deduplication via DB lookup)
 *   4. Classifies each inbound message
 *   5. Applies stop logic if the most actionable classification is REAL_REPLY
 *   6. Records NEEDS_REVIEW classifications without stopping
 *
 * Design:
 *   - Processes threads sequentially to avoid Gmail rate-limit spikes
 *   - Conservative: never stops on NEEDS_REVIEW or AUTO_REPLY
 *   - Idempotent: already-stopped sequences are detected and skipped
 *   - OAuth scope required: gmail.readonly (added to GMAIL_SCOPES in Phase 6)
 *
 * Server-side only. Never import from client components.
 */

import { google } from "googleapis";
import prisma from "@/lib/prisma";
import { getOAuthConfig, createOAuth2Client } from "@/lib/gmail/oauth";
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

// ── Main scan function ────────────────────────────────────────────────────────

/**
 * Scan all active sequences for replies.
 * Returns a structured ScanResult with per-thread outcomes.
 */
export async function scanForReplies(): Promise<ScanResult> {
  const startedAt = new Date();

  replyLog("reply_scan_started", {});

  // ── 1. Validate OAuth config ──────────────────────────────────────────────
  const config = getOAuthConfig();
  if (!config) {
    replyLog("reply_oauth_missing", {
      detail:
        "GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, or GMAIL_SENDER_EMAIL missing.",
    });
    return buildScanResult(startedAt, [], "CONFIG_ERROR");
  }

  // ── 2. Load active sequences with gmail_thread_id ─────────────────────────
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

  // ── 3. Process each thread sequentially ───────────────────────────────────
  const results: ThreadScanResult[] = [];
  
  
  let auth: any;
  try {
    auth = createOAuth2Client();
  } catch (err) {
    replyLog("reply_scan_error", { detail: "Failed to create OAuth client for scanning." });
    return buildScanResult(startedAt, [], "FAILED");
  }

  for (const thread of activeThreads) {
    const result = await scanThread(thread, config.senderEmail, auth);
    results.push(result);
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

interface ActiveThread {
  gmailThreadId: string;
  sequenceId: string;
  prospectId: string;
  prospectName: string;
  prospectEmail: string;
  ourMessageIds: Set<string>;
}

async function scanThread(
  thread: ActiveThread,
  senderEmail: string,
  
  auth: any
): Promise<ThreadScanResult> {
  const { gmailThreadId, sequenceId, prospectId, prospectName, prospectEmail } =
    thread;

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

  // Fetch the Gmail thread
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

    // 1. Skip our own system-sent messages (initial emails, follow-ups)
    if (thread.ourMessageIds.has(msg.id)) {
      replyLog("reply_message_skipped_system_outbound", {
        gmailThreadId,
        gmailMessageId: msg.id,
      });
      return false;
    }

    // 2. Skip our own manual sent messages (unless running live integration test OR testing on ourselves)
    if (fromEmail.toLowerCase() === senderEmail.toLowerCase() && !isFromProspect) {
      if (process.env.LIVE_TEST_OVERRIDE === "true" && msg.snippet.toLowerCase().includes("simulated reply")) {
        // Allow the simulated reply to pass through for integration testing
      } else {
        replyLog("reply_message_skipped_own", {
          gmailThreadId,
          gmailMessageId: msg.id,
        });
        return false;
      }
    }

    // Skip already-classified messages
    if (alreadyClassifiedIds.has(msg.id)) {
      replyLog("reply_message_skipped_duplicate", {
        gmailThreadId,
        gmailMessageId: msg.id,
      });
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

      // Apply atomic stop logic
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

    case "AUTO_REPLY":
    case "SPAM": {
      replyLog("reply_classified_auto", {
        gmailThreadId,
        gmailMessageId: best.gmailMessageId,
        sequenceId,
        prospectId,
        replyType: best.replyType,
        reason: best.reason,
      });
      outcome = "AUTO_REPLY";
      break;
    }

    case "NEEDS_REVIEW": {
      replyLog("reply_classified_uncertain", {
        gmailThreadId,
        gmailMessageId: best.gmailMessageId,
        sequenceId,
        prospectId,
        fromEmail: best.fromEmail,
        reason: best.reason,
      });

      // Record for review but do NOT stop the sequence
      try {
        await recordNeedsReview(prospectId, best, prospectEmail, prospectName);
      } catch {
        // Non-fatal — classification record is advisory only
      }
      outcome = "NEEDS_REVIEW";
      break;
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
 * Load all ACTIVE sequences that have at least one step with a gmail_thread_id.
 * These are the sequences we need to check for replies.
 */
async function loadActiveThreads(): Promise<ActiveThread[]> {
  const sequences = await prisma.sequence.findMany({
    where: {
      status: { in: ["ACTIVE", "COMPLETED"] },
      steps: {
        some: {
          gmail_thread_id: { not: null },
        },
      },
    },
    select: {
      id: true,
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

  return sequences
    .map((s) => ({
      gmailThreadId: s.steps[0].gmail_thread_id!,
      sequenceId: s.id,
      prospectId: s.prospect.id,
      prospectName: s.prospect.name,
      prospectEmail: s.prospect.email,
      ourMessageIds: new Set(s.steps.map(step => step.gmail_message_id).filter(id => id != null) as string[]),
    }));
}

/**
 * Fetch all messages in a Gmail thread.
 * Returns InboundMessage[] with headers and snippet extracted.
 */
async function fetchThreadMessages(
  threadId: string,
  
  auth: any
): Promise<InboundMessage[]> {
  
  const gmail = google.gmail({ version: "v1", auth: auth as any });

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
async function getClassifiedMessageIds(
  gmailThreadId: string
): Promise<Set<string>> {
  const existing = await prisma.replyClassification.findMany({
    where: { gmail_thread_id: gmailThreadId },
    select: { gmail_message_id: true },
  });
  return new Set(existing.map((r) => r.gmail_message_id));
}

/**
 * Record a NEEDS_REVIEW classification with intelligence policy analysis.
 * Stores advisory AI outputs (confidence, reason, recommended_action, signals)
 * for operator review without stopping the sequence.
 */
export async function recordNeedsReview(
  prospectId: string,
  classification: import("./types").ClassificationResult,
  prospectEmail: string,
  prospectName: string
): Promise<void> {
  try {
    // ── Evaluate Intelligence Policy ──────────────────────────────────────
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
    // Non-fatal — advisory record
    const msg = err instanceof Error ? err.message : "Upsert error";
    replyLog("intelligence_analysis_failed", {
      gmailMessageId: classification.gmailMessageId,
      detail: `Failed to record intelligence review: ${msg}`,
    });
  }
}

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
