/**
 * Gmail Sender — Core Send Pipeline
 *
 * Implements the Phase 5 contract established by the Phase 4 scheduler:
 *
 *   Phase 4 claims step (PENDING → PROCESSING)
 *   ↓
 *   Phase 5 fetches step by ID
 *   ↓
 *   Phase 5 verifies step is still PROCESSING (pre-send guard)
 *   ↓
 *   Phase 5 sends via Gmail API
 *   ↓
 *   Phase 5 marks step SENT (success) or FAILED (error)
 *
 * Idempotency guarantees:
 *   - Only PROCESSING steps are ever sent
 *   - SENT steps are never resent (gmail_message_id is already set)
 *   - CANCELLED/FAILED/SKIPPED steps are rejected at the pre-send guard
 *   - If step.gmail_message_id is already set (anomaly), sending is aborted
 *
 * Failure handling:
 *   - Gmail API failure → step marked FAILED
 *   - DB update failure after successful Gmail send → retried 3 times;
 *     if all retries fail, step is marked FAILED and the Gmail message ID
 *     is logged at ERROR level so it can be manually reconciled
 *
 * Server-side only. Never import from client components.
 */

import { google } from "googleapis";
import prisma from "@/lib/prisma";
import { getOAuthConfig, createOAuth2Client } from "./oauth";
import { buildGmailMessage } from "./message";
import { loadStepForSend } from "./query";
import { gmailLog } from "./logger";
import { logger } from "@/lib/observability/logger";
import { errorTracker } from "@/lib/observability/errors";
import { canSendEmail, recordSuccessfulSend } from "@/lib/reputation/guard";
import { emailTrackingService } from "@/lib/tracking/EmailTrackingService";
import { TrackingInjector } from "@/lib/tracking/TrackingInjector";
import { reportSystemError } from "@/lib/intelligence/error-engine";
import type { StepSendResult, BatchSendResult, StepForSend } from "./types";

// ── Send a single step ────────────────────────────────────────────────────────

/**
 * Send one claimed sequence step through Gmail.
 *
 * This is the core Phase 5 operation. It follows the exact contract
 * established by the Phase 4 scheduler.
 */

export async function sendStep(stepId: string, cachedAuth?: any): Promise<StepSendResult> {
  gmailLog("gmail_send_started", { stepId });

  // ── 1. Validate OAuth config ──────────────────────────────────────────────
  const config = getOAuthConfig();
  if (!config) {
    gmailLog("gmail_oauth_missing", {
      stepId,
      detail:
        "GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, or GMAIL_SENDER_EMAIL is missing from environment.",
    });
    return {
      stepId,
      outcome: "CONFIG_ERROR",
      detail:
        "Gmail OAuth is not configured. Set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, and GMAIL_SENDER_EMAIL in your .env.local file.",
    };
  }

  // ── 2. Load full step data (includes body) ────────────────────────────────
  let step: StepForSend | null;
  try {
    step = await loadStepForSend(stepId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "DB read error";
    gmailLog("gmail_send_failed", { stepId, detail: `DB load failed: ${msg}` });
    return { stepId, outcome: "FAILED", detail: `Failed to load step data: ${msg}` };
  }

  if (!step) {
    gmailLog("gmail_send_aborted_stale_step", {
      stepId,
      detail: "Step not found in database.",
    });
    return { stepId, outcome: "ABORTED", detail: "Step not found." };
  }

  // ── 3. Pre-send verification — must be PROCESSING ─────────────────────────
  if (step.status !== "PROCESSING") {
    gmailLog("gmail_send_aborted_stale_step", {
      stepId,
      stepNumber: step.step_number,
      prospectId: step.sequence.prospect.id,
      prospectName: step.sequence.prospect.name,
      detail: `Step status is "${step.status}" — expected PROCESSING. Step was cancelled, sent, or failed before the sender ran.`,
    });
    return {
      stepId,
      outcome: "ABORTED",
      detail: `Step is no longer PROCESSING (current status: ${step.status}). Not sent.`,
    };
  }

  // ── 4. Idempotency guard — abort if already has a Gmail message ID ────────
  // This should not happen in normal operation, but protects against
  // anomalous duplicate invocations after a partial failure.
  if (step.gmail_message_id) {
    gmailLog("gmail_send_aborted_stale_step", {
      stepId,
      detail: `Step already has gmail_message_id "${step.gmail_message_id}" — refusing to resend.`,
    });
    return {
      stepId,
      outcome: "ABORTED",
      detail: "Step already has a Gmail message ID. Not resent to prevent duplicates.",
    };
  }

  // ── 4.5 Reputation Protection Guard ─────────────────────────────────────────
  const reputationResult = await canSendEmail(config.senderEmail);
  if (!reputationResult.allowed) {
    gmailLog("gmail_send_aborted_limit", {
      stepId,
      detail: `Reputation guard delayed sending. Reason: ${reputationResult.reason}`
    });
    
    await prisma.sequenceStep.update({
      where: { id: stepId },
      data: {
        status: "DELAYED",
        delay_reason: reputationResult.reason,
        retry_at: reputationResult.retryAt
      }
    });

    return {
      stepId,
      outcome: "ABORTED",
      detail: `Sending delayed by reputation guard: ${reputationResult.reason}`,
    };
  }

  gmailLog("gmail_send_verified_processing", {
    stepId,
    stepNumber: step.step_number,
    sequenceId: step.sequence.id,
    prospectId: step.sequence.prospect.id,
    prospectName: step.sequence.prospect.name,
    subject: step.subject,
  });

  // ── 5. Build the Gmail message payload ────────────────────────────────────
  // Thread continuation: for Step 2+, use the previous step's thread/message IDs
  const previousThreadId = step.previousStep?.gmail_thread_id ?? undefined;
  const previousMessageId = step.previousStep?.gmail_message_id ?? undefined;

  // Tracking Engine: Register Email
  const trackingId = await emailTrackingService.registerEmail({
    provider: "GMAIL",
    senderEmail: config.senderEmail,
    recipientEmail: step.sequence.prospect.email,
    subject: step.subject,
    sourceType: "SEQUENCE_STEP",
    sourceId: stepId,
  });

  // Tracking Engine: Inject Pixel safely into HTML part only
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  // const trackingPixel = TrackingInjector.generatePixel(trackingId, baseUrl);
  const trackingPixel = ""; // Temporarily disabled for deliverability experiment

  const messagePayload = buildGmailMessage({
    from: config.senderEmail,
    to: step.sequence.prospect.email,
    toName: step.sequence.prospect.name,
    subject: step.subject,
    body: step.body, // Pure plain text, no HTML tags
    inReplyToMessageId: previousMessageId,
    threadId: previousThreadId,
    trackingPixel,
  });

  // ── 6. Send via Gmail API ─────────────────────────────────────────────────
  let gmailMessageId: string;
  let gmailThreadId: string;

  try {
    const auth = cachedAuth || createOAuth2Client();
    // `auth as any` is required because googleapis and googleapis-common bundle
    // separate copies of google-auth-library, causing TS to see mismatched private
    // members. The runtime type is correct — this is a known packaging issue.
    
    const gmail = google.gmail({ version: "v1", auth: auth as any });

    const response = await gmail.users.messages.send({
      userId: "me", // "me" refers to the authenticated user
      requestBody: {
        raw: messagePayload.raw,
        ...(messagePayload.threadId
          ? { threadId: messagePayload.threadId }
          : {}),
      },
    });

    if (!response.data.id || !response.data.threadId) {
      throw new Error(
        "Gmail API returned a response without message ID or thread ID."
      );
    }

    gmailMessageId = response.data.id;
    gmailThreadId = response.data.threadId;

    // Tracking Engine: Map the identifiers and ingest SENT event
    await emailTrackingService.setProviderMapping(trackingId, gmailMessageId, gmailThreadId);
    await emailTrackingService.ingestEvent(trackingId, "SENT");
  } catch (err) {
    const msg = extractSafeErrorMessage(err);
    gmailLog("gmail_send_failed", {
      stepId,
      stepNumber: step.step_number,
      prospectId: step.sequence.prospect.id,
      detail: msg,
    });

    await reportSystemError({
      service: "gmail",
      originalError: err,
      impactSize: 1, // At least 1 email affected right now
    });

    // Mark step as FAILED so the scheduler does not re-claim it
    await markStepFailed(stepId, step);
    return { stepId, outcome: "FAILED", detail: `Gmail send failed: ${msg}` };
  }

  // ── 7. Update DB: mark SENT with Gmail IDs ────────────────────────────────
  // The Gmail send already happened. We MUST persist the result.
  // If this DB update fails, we retry before giving up.
  const dbUpdateSuccess = await markStepSent(
    stepId,
    gmailMessageId,
    gmailThreadId,
    step
  );

  if (!dbUpdateSuccess) {
    // Gmail send succeeded but we could not record it.
    // Log the Gmail message ID prominently so it can be manually reconciled.
    const err = new Error(`Gmail send succeeded (messageId=${gmailMessageId}) but DB update failed for step ${stepId}.`);
    logger.critical(`Gmail send succeeded but DB update failed for step ${stepId}`, { error: err.message, stepId, gmailMessageId });
    await errorTracker.trackError({ 
      service: "Gmail Sender", 
      category: "Database", 
      severity: "CRITICAL", 
      message: err.message, 
      error: err 
    });

    return {
      stepId,
      outcome: "FAILED",
      gmailMessageId,
      gmailThreadId,
      detail:
        "Email was sent but the database update failed. The message was delivered. Check server logs.",
    };
  }

  // Record successful send for reputation tracking
  await recordSuccessfulSend(config.senderEmail);

  gmailLog("gmail_send_success", {
    stepId,
    stepNumber: step.step_number,
    sequenceId: step.sequence.id,
    prospectId: step.sequence.prospect.id,
    prospectName: step.sequence.prospect.name,
    gmailMessageId,
    gmailThreadId,
  });

  return {
    stepId,
    outcome: "SENT",
    gmailMessageId,
    gmailThreadId,
    detail: "Email sent successfully.",
  };
}

// ── Send a batch of claimed steps ─────────────────────────────────────────────

/**
 * Send all steps identified by the provided IDs.
 * Called after the scheduler returns claimedStepIds.
 *
 * Processes steps sequentially to avoid Gmail rate-limit issues.
 * Returns a BatchSendResult with per-step outcomes.
 */
export async function sendBatch(stepIds: string[]): Promise<BatchSendResult> {
  const startedAt = new Date();

  gmailLog("gmail_batch_started", { total: stepIds.length });

  const results: StepSendResult[] = [];
  let sent = 0;
  let failed = 0;
  let aborted = 0;
  let configErrors = 0;

  // Initialize OAuth client once per batch
  
  let auth: any;
  try {
    auth = createOAuth2Client();
  } catch (e) {
    gmailLog("gmail_batch_completed", { total: stepIds.length, sent: 0, failed: 0, aborted: 0, durationMs: 0, status: "CONFIG_ERROR" });
  }

  for (const stepId of stepIds) {
    const result = await sendStep(stepId, auth);
    results.push(result);

    switch (result.outcome) {
      case "SENT":
        sent++;
        break;
      case "FAILED":
        failed++;
        break;
      case "ABORTED":
        aborted++;
        break;
      case "CONFIG_ERROR":
        configErrors++;
        // If OAuth is missing, no point continuing — all remaining steps will fail
        // Fill remaining steps as CONFIG_ERROR without attempting
        for (const remainingId of stepIds.slice(results.length)) {
          results.push({
            stepId: remainingId,
            outcome: "CONFIG_ERROR",
            detail: "Skipped: Gmail OAuth not configured.",
          });
          configErrors++;
        }
        break;
    }

    // Stop if we hit a config error — all remaining will fail the same way
    if (result.outcome === "CONFIG_ERROR") break;
  }

  const finishedAt = new Date();
  const durationMs = finishedAt.getTime() - startedAt.getTime();

  const status =
    configErrors > 0
      ? "CONFIG_ERROR"
      : failed === 0 && aborted === 0
      ? "SUCCESS"
      : sent === 0
      ? "FAILED"
      : "PARTIAL_FAILURE";

  gmailLog("gmail_batch_completed", {
    total: stepIds.length,
    sent,
    failed,
    aborted,
    durationMs,
    status,
  });

  return {
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs,
    total: stepIds.length,
    sent,
    failed,
    aborted,
    configErrors,
    results,
    status,
  };
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Mark a step as SENT with Gmail message and thread IDs.
 * Retries up to 3 times on DB failure.
 * Returns true on success, false if all retries exhausted.
 */
async function markStepSent(
  stepId: string,
  gmailMessageId: string,
  gmailThreadId: string,
  step: StepForSend
): Promise<boolean> {
  const MAX_RETRIES = 3;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await prisma.$transaction(async (tx) => {
        await tx.sequenceStep.update({
          where: { id: stepId },
          data: {
            status: "SENT",
            sent_at: new Date(),
            gmail_message_id: gmailMessageId,
            gmail_thread_id: gmailThreadId,
          },
        });
        await tx.emailEvent.create({
          data: {
            sequence_step_id: stepId,
            event_type: "SENT",
            metadata: { gmailMessageId, gmailThreadId },
          },
        });
      });
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "DB error";
      gmailLog("gmail_send_db_update_failed", {
        stepId,
        stepNumber: step.step_number,
        prospectId: step.sequence.prospect.id,
        detail: `Attempt ${attempt}/${MAX_RETRIES} failed: ${msg}`,
      });
      if (attempt < MAX_RETRIES) {
        // Brief exponential backoff before retry
        await sleep(attempt * 200);
      }
    }
  }
  return false;
}

/**
 * Mark a step as FAILED.
 * Best-effort — logs a warning if this DB update also fails.
 */
async function markStepFailed(
  stepId: string,
  step: StepForSend
): Promise<void> {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.sequenceStep.update({
        where: { id: stepId },
        data: { status: "FAILED" },
      });
      await tx.emailEvent.create({
        data: {
          sequence_step_id: stepId,
          event_type: "FAILED",
        },
      });
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "DB error";
    logger.error("Failed to mark step as FAILED after send error", { stepId, error: msg });
    await errorTracker.trackError({
      service: "Gmail Sender",
      category: "Database",
      severity: "HIGH",
      message: `Failed to mark step ${stepId} as FAILED after send error. Step may remain stuck in PROCESSING. DB error: ${msg}`,
      error: err
    });
  }
}

/**
 * Extract a safe, non-secret error message from a caught error.
 * Gmail API errors can contain auth headers — we only expose the status message.
 */
function extractSafeErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    // Strip any token-like strings from the message as a safety measure
    return err.message
      .replace(/ya29\.[A-Za-z0-9._-]+/g, "[ACCESS_TOKEN_REDACTED]")
      .replace(/refresh_token=[^&\s]*/gi, "refresh_token=[REDACTED]")
      .slice(0, 400); // cap length
  }
  return "Unknown error";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
