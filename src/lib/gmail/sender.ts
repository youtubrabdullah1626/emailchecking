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

import * as fs from "fs";
import * as path from "path";
import { google } from "googleapis";
import prisma from "@/lib/prisma";
import { getOAuthConfig, createOAuth2Client, createOAuth2ClientForAccount } from "./oauth";
import { buildGmailMessage } from "./message";
import { loadStepForSend } from "./query";
import { gmailLog } from "./logger";
import { logger } from "@/lib/observability/logger";
import { errorTracker } from "@/lib/observability/errors";
import { canSendEmail, recordSuccessfulSend } from "@/lib/reputation/guard";
import { emailTrackingService } from "@/lib/tracking/EmailTrackingService";
import { TrackingInjector } from "@/lib/tracking/TrackingInjector";
import { reportSystemError } from "@/lib/intelligence/error-engine";
import { DeliverabilityHealthEvaluator } from "@/lib/reputation/DeliverabilityHealthModel";
import type { StepSendResult, BatchSendResult, StepForSend } from "./types";

// ── Send a single step ────────────────────────────────────────────────────────

/**
 * Send one claimed sequence step through Gmail.
 *
 * This is the core Phase 5 operation. It follows the exact contract
 * established by the Phase 4 scheduler.
 */

export async function sendStepInternal(stepId: string, cachedAuth?: any): Promise<StepSendResult> {
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

  // ── 2.5 Smart Sticky Sender & Multi-Inbox Rotation Engine ───────────────────
  let connectedAccount: any = null;
  const assignedEmail = step.sequence.assigned_sender_email;

  // 1. Thread Continuity (Sticky Sender): ONLY for follow-ups (Step 2+)
  if (assignedEmail && step.step_number > 1) {
    connectedAccount = await prisma.emailAccount.findFirst({
      where: { 
        email: assignedEmail.toLowerCase(),
        connection_status: "CONNECTED",
      },
    });

    if (!connectedAccount) {
      gmailLog("gmail_sticky_sender_unavailable", {
        stepId,
        assignedEmail,
        detail: "Locked sender is currently disconnected. Evaluating fallback connected inboxes.",
      });
    }
  }

  // 2. Step 1 (Fresh sequence) or Fallback: Live load-balance across all active inboxes
  if (!connectedAccount) {
    if (prisma.emailAccount?.findMany) {
      let activeInboxes = await prisma.emailAccount.findMany({
        where: { 
          connection_status: "CONNECTED",
          ...(step.sequence.user_id ? { user_id: step.sequence.user_id } : {}),
        },
      });

      if (!activeInboxes || activeInboxes.length === 0) {
        activeInboxes = await prisma.emailAccount.findMany({
          where: { connection_status: "CONNECTED" },
        });
      }

      if (activeInboxes && activeInboxes.length > 0) {
        const startOfDay = new Date();
        startOfDay.setUTCHours(0, 0, 0, 0);

        // Count today's sent emails per inbox for live round-robin load balancing
        const inboxesWithCounts = await Promise.all(
          activeInboxes.map(async (acc) => {
            const count = await prisma.emailEvent.count({
              where: {
                event_type: "SENT",
                occurred_at: { gte: startOfDay },
                step: {
                  sequence: {
                    assigned_sender_email: acc.email.toLowerCase(),
                  },
                },
              },
            }).catch(() => acc.sent_today || 0);

            return {
              account: acc,
              sentCount: count,
              lastSeen: acc.last_seen_at ? new Date(acc.last_seen_at).getTime() : 0,
            };
          })
        );

        // Sort by:
        // 1. Least sent today (primary load balance)
        // 2. Oldest last_seen_at (secondary alternation)
        inboxesWithCounts.sort((a, b) => {
          if (a.sentCount !== b.sentCount) return a.sentCount - b.sentCount;
          return a.lastSeen - b.lastSeen;
        });

        connectedAccount = inboxesWithCounts[0].account;
      }
    } else if (prisma.emailAccount?.findFirst) {
      connectedAccount = await prisma.emailAccount.findFirst({
        where: { 
          connection_status: "CONNECTED",
        },
        orderBy: { updated_at: "desc" }
      });
    }

    // Lock this sequence to the selected inbox for unbroken future thread continuity
    if (connectedAccount && prisma.sequence?.update) {
      await prisma.sequence.update({
        where: { id: step.sequence.id },
        data: { assigned_sender_email: connectedAccount.email.toLowerCase() },
      }).catch((err) => {
        gmailLog("gmail_sticky_lock_failed", {
          sequenceId: step.sequence.id,
          error: String(err),
        });
      });
    }
  }

  const senderEmail = connectedAccount?.email || config.senderEmail || process.env.GMAIL_SENDER_EMAIL;

  if (!senderEmail) {
    gmailLog("gmail_send_failed", { stepId, detail: "No connected Gmail sending account found in DB." });
    return {
      stepId,
      outcome: "CONFIG_ERROR",
      detail: "No connected Gmail account found for sending. Please connect your Gmail in Settings.",
    };
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
  const reputationResult = await canSendEmail(senderEmail);
  if (!reputationResult.allowed) {
    gmailLog("gmail_send_aborted_limit", {
      stepId,
      detail: `Reputation guard delayed sending. Reason: ${reputationResult.reason}`
    });
    
    await prisma.sequenceStep.update({
      where: { id: stepId },
      data: {
        status: "RETRYABLE_FAILURE",
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

  // ── 4.6 Deliverability Pipeline V2 (Feature Flag & Health Check) ───────────
  const DELIVERABILITY_PIPELINE_V2 = process.env.DELIVERABILITY_PIPELINE_V2 === "true";
  let enableListUnsubscribe = false;

  if (DELIVERABILITY_PIPELINE_V2) {
    const health = await DeliverabilityHealthEvaluator.evaluateHealth(senderEmail);
    if (health.overall === "FAILING") {
      gmailLog("gmail_send_aborted_health", {
        stepId,
        detail: `Deliverability Health Evaluator blocked sending due to FAILING health.`,
        health_status: health.overall
      });
      return {
        stepId,
        outcome: "ABORTED",
        detail: "Sending blocked by Deliverability Health Evaluator.",
      };
    }
    
    // Enable List-Unsubscribe if configured, default true for V2 pipeline
    enableListUnsubscribe = process.env.ENABLE_LIST_UNSUBSCRIBE !== "false";
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
  const previousInternalMessageId = step.previousStep?.gmail_message_id ?? undefined;
  
  let previousRfcMessageId: string | undefined = undefined;
  
  const auth = cachedAuth || await createOAuth2ClientForAccount(senderEmail);
  const gmail = google.gmail({ version: "v1", auth: auth as any });

  // Fetch the true RFC Message-ID to use for In-Reply-To chaining
  if (previousInternalMessageId) {
    try {
      const prevMsg = await gmail.users.messages.get({
        userId: "me",
        id: previousInternalMessageId,
        format: "metadata",
        metadataHeaders: ["Message-ID"],
      });
      const rfcHeader = prevMsg.data.payload?.headers?.find(h => h.name === "Message-ID");
      if (rfcHeader && rfcHeader.value) {
        previousRfcMessageId = rfcHeader.value;
      }
    } catch (err) {
      gmailLog("gmail_fetch_prev_msg_failed", {
        stepId,
        detail: `Could not fetch previous message ID ${previousInternalMessageId} to get RFC Message-ID. Threading might rely solely on threadId.`
      });
    }
  }

  // Tracking Engine: Register Email
  const trackingId = await emailTrackingService.registerEmail({
    provider: "GMAIL",
    senderEmail: senderEmail,
    recipientEmail: step.sequence.prospect.email,
    subject: step.subject,
    sourceType: "SEQUENCE_STEP",
    sourceId: stepId,
    userId: step.sequence.user_id || undefined,
  });

  // Tracking Engine: Only inject pixel if NEXT_PUBLIC_APP_URL is a real public HTTPS URL.
  // Using localhost:3000 in a tracking pixel is a top-tier spam signal — Google flags it
  // as a hidden link to a private/internal server, identical to phishing email patterns.
  const baseUrl = (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : "") ||
    (process.env.RAILWAY_STATIC_URL ? `https://${process.env.RAILWAY_STATIC_URL}` : "") ||
    "https://reachiq.up.railway.app"
  ).replace(/\/+$/, "");
  const trackingPixel = TrackingInjector.generatePixel(trackingId, baseUrl);


  const messagePayload = buildGmailMessage({
    from: senderEmail,
    to: step.sequence.prospect.email,
    toName: step.sequence.prospect.name,
    subject: step.subject,
    body: step.body,
    inReplyToMessageId: previousRfcMessageId,
    threadId: previousThreadId,
    trackingPixel,
    enableListUnsubscribe,
  });

  // ── 5.5 Create send attempt record BEFORE calling Gmail ─────────────────
  // Crash-safety anchor — used by reconciler to detect orphaned sends.
  // If creation fails, we still proceed: a missing audit record is far less
  // harmful than leaving a step stuck in PROCESSING indefinitely.
  const prevAttempts = await prisma.sendAttempt.count({ where: { step_id: stepId } }).catch(() => 0);
  let sendAttempt: { id: string } | null = null;
  try {
    sendAttempt = await prisma.sendAttempt.create({
      data: {
        step_id: stepId,
        attempt_number: prevAttempts + 1,
        sender_email: senderEmail,
        recipient_email: step.sequence.prospect.email,
        status: 'ATTEMPTING',
      },
      select: { id: true },
    });
  } catch (attemptErr) {
    // IMPORTANT: Warn but DO NOT abort. A missing audit record is far less
    // harmful than leaving a step permanently stuck in PROCESSING.
    gmailLog('gmail_send_attempt_record_skipped', {
      stepId,
      detail: 'sendAttempt record creation failed — proceeding with send anyway.',
    });
    // sendAttempt stays null; downstream null checks handle this safely
  }

  // ── 6. Send via Gmail API ─────────────────────────────────────────────────
  let gmailMessageId: string;
  let gmailThreadId: string;

  try {
    // auth and gmail clients are already instantiated above

    // Retry configuration
    const MAX_API_RETRIES = 3;
    let attempt = 1;
    let response: any;

    while (attempt <= MAX_API_RETRIES) {
      try {
        response = await gmail.users.messages.send({
          userId: "me", // "me" refers to the authenticated user
          requestBody: {
            raw: messagePayload.raw,
            ...(messagePayload.threadId
              ? { threadId: messagePayload.threadId }
              : {}),
          },
        });
        // If successful, break out of retry loop
        break;
      } catch (err: any) {
        const status = err?.status || err?.code;
        // Retry only on transient errors: 429 Too Many Requests, or 5xx Server Errors
        if (status === 429 || (status >= 500 && status < 600)) {
          if (attempt === MAX_API_RETRIES) throw err;
          // Fast backoff: 500ms, 1000ms — keeps interactive sends snappy
          await sleep(attempt * 500);
          attempt++;
        } else {
          // Fatal error (e.g. 400 Bad Request, 403 Forbidden), do not retry
          throw err;
        }
      }
    }

    if (!response.data.id || !response.data.threadId) {
      throw new Error(
        `Gmail API returned incomplete response: missing id or threadId. Response: ${JSON.stringify(
          response.data
        )}`
      );
    }

    gmailMessageId = response.data.id;
    gmailThreadId = response.data.threadId;

    if (sendAttempt) {
      await prisma.sendAttempt.update({
        where: { id: sendAttempt.id },
        data: { status: 'SENT', gmail_message_id: gmailMessageId }
      }).catch(() => {});
    }

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

    // Check for Auth / Token Revocation
    const isAuthError = msg.toLowerCase().includes("invalid_grant") || 
                        msg.toLowerCase().includes("token has been expired") ||
                        msg.toLowerCase().includes("invalid credentials");

    if (isAuthError) {
      if (sendAttempt) {
        await prisma.sendAttempt.update({ where: { id: sendAttempt.id }, data: { status: 'FAILED', error_message: 'Auth error - needs reconnect' } }).catch(() => {});
      }
      // Mark the mailbox as needing reconnection and gracefully delay the step
      if (prisma.emailAccount?.updateMany) {
        await prisma.emailAccount.updateMany({
          where: { email: senderEmail },
          data: { connection_status: "DISCONNECTED" }
        }).catch(() => {});
      }

      if (prisma.sequenceStep?.update) {
        await prisma.sequenceStep.update({
          where: { id: stepId },
          data: {
            status: "PENDING",
            delay_reason: "NEEDS_RECONNECT",
            retry_at: null
          }
        }).catch(() => {});
      }

      return { 
        stepId, 
        outcome: "ABORTED", 
        detail: `Gmail account ${senderEmail} needs reconnection. Step safely delayed.` 
      };
    }

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
    step,
    senderEmail
  );

  if (!dbUpdateSuccess) {
    // Gmail send succeeded but we could not record it.
    // DEAD LETTER FALLBACK: Write to local disk to prevent duplicate resends if recovered.
    try {
      const fallbackDir = path.join(process.cwd(), "logs");
      if (!fs.existsSync(fallbackDir)) fs.mkdirSync(fallbackDir, { recursive: true });
      
      const logEntry = JSON.stringify({ 
        stepId, gmailMessageId, gmailThreadId, sentAt: new Date().toISOString() 
      }) + "\n";
      
      fs.appendFileSync(path.join(fallbackDir, "orphan-sends.jsonl"), logEntry);
    } catch (fsErr) {
      console.error("CRITICAL: Failed to write to dead-letter fallback log", fsErr);
    }

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
  await recordSuccessfulSend(senderEmail);

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

  for (let i = 0; i < stepIds.length; i++) {
    const stepId = stepIds[i];
    const result = await sendStep(stepId);
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

    // Human-like random delay between sends (15–45 seconds).
    // Sending emails back-to-back instantly is a strong bulk-sender pattern that
    // Gmail's anti-spam systems flag. A random delay mimics natural human behavior
    // and significantly improves inbox placement.
    if (i < stepIds.length - 1 && result.outcome === "SENT") {
      const delayMs = process.env.NODE_ENV === "test" ? 0 : 15000 + Math.floor(Math.random() * 30000); // 15s to 45s
      if (delayMs > 0) {
        gmailLog("gmail_human_delay", { stepId, delayMs, nextStepIndex: i + 1 });
        await sleep(delayMs);
      }
    }
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
  step: StepForSend,
  senderEmail?: string
): Promise<boolean> {
  const MAX_RETRIES = 3;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      // Direct sequential updates (100% pooler-safe on Supabase transaction pooler)
      await prisma.sequenceStep.update({
        where: { id: stepId },
        data: {
          status: "SENT",
          sent_at: new Date(),
          gmail_message_id: gmailMessageId,
          gmail_thread_id: gmailThreadId,
        },
      });

      if (prisma.emailEvent?.create) {
        try {
          await prisma.emailEvent.create({
            data: {
              sequence_step_id: stepId,
              event_type: "SENT",
              metadata: { gmailMessageId, gmailThreadId },
            },
          });
        } catch {}
      }

      if (senderEmail && prisma.emailAccount?.update) {
        try {
          await prisma.emailAccount.update({
            where: { email: senderEmail.toLowerCase() },
            data: {
              sent_today: { increment: 1 },
              sent_this_hour: { increment: 1 },
              last_seen_at: new Date(),
            },
          });
        } catch {}
      }

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
    await prisma.sequenceStep.update({
      where: { id: stepId },
      data: { status: "FAILED" },
    });
    await prisma.emailEvent.create({
      data: {
        sequence_step_id: stepId,
        event_type: "FAILED",
      },
    }).catch(() => {});
  } catch (err) {
    const msg = err instanceof Error ? err.message : "DB error";
    logger.error("Failed to mark step as FAILED after send error", { stepId, error: msg });
  }
}

/**
 * Extract a safe, non-secret error message from a caught error.
 * Gmail API errors can contain auth headers — we only expose the status message.
 */
function extractSafeErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    // Deep sanitization: Strip any token-like strings, JWTs, or client secrets
    return err.message
      .replace(/ya29\.[A-Za-z0-9._-]+/g, "[ACCESS_TOKEN_REDACTED]")
      .replace(/refresh_token=[^&\s]*/gi, "refresh_token=[REDACTED]")
      .replace(/client_secret=[^&\s]*/gi, "client_secret=[REDACTED]")
      .replace(/ey[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/g, "[JWT_REDACTED]")
      .slice(0, 400); // cap length
  }
  return "Unknown error";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sendStep(stepId: string, cachedAuth?: any): Promise<StepSendResult> {
  const step = await prisma.sequenceStep.findUnique({
    where: { id: stepId },
    select: { sequence: { select: { assigned_sender_email: true } } },
  });
  const wasReserved = !!step?.sequence?.assigned_sender_email;
  const reservedEmail = step?.sequence?.assigned_sender_email;

  const result = await sendStepInternal(stepId, cachedAuth);

  if (wasReserved && reservedEmail) {
    await prisma.$executeRaw`UPDATE email_accounts SET reserved_count = GREATEST(0, reserved_count - 1) WHERE email = ${reservedEmail.toLowerCase()}`.catch(() => {});
  }
  return result;
}
