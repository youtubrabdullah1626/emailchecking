/**
 * GET /api/cron/scheduler
 * POST /api/cron/scheduler
 *
 * Vercel Cron Entry Point — Phase 11 Autonomous Scheduler
 *
 * Called every 15 minutes by the Vercel Cron job configured in vercel.json.
 * May also be called via POST by any authenticated external cron service
 * (e.g. cron-job.org, Betterstack, GitHub Actions).
 *
 * Executes the full scheduler + Gmail send pipeline + Reply Scanner:
 *   1. Run scheduler (claim all due PENDING steps → PROCESSING)
 *   2. Send all claimed steps via Gmail API (PROCESSING → SENT | FAILED)
 *   3. Run Reply Scanner (detect replies, update DB, stop sequences)
 *   4. Return a structured result for cron monitoring
 *
 * Authentication:
 *   Vercel Cron automatically provides `Authorization: Bearer <CRON_SECRET>`.
 *   External callers may use the SCHEDULER_SECRET instead.
 *   The route accepts both.
 *
 * CRON_SECRET is set automatically by Vercel in production.
 * SCHEDULER_SECRET is the fallback for external callers.
 */

import { NextRequest, NextResponse } from "next/server";
import { runScheduler } from "@/lib/scheduler/run";
import { sendBatch } from "@/lib/gmail/sender";
import { scanForReplies } from "@/lib/reply/scanner";
import { timingSafeEqual, createHash } from "crypto";
import { logger } from "@/lib/observability/logger";
import { withObservability } from "@/lib/observability/middleware";
import prisma from "@/lib/prisma";
import { google } from "googleapis";
import { getOAuthConfig, createOAuth2Client } from "@/lib/gmail/oauth";
import { buildGmailMessage } from "@/lib/gmail/message";

function verifyCronSecret(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  const schedulerSecret = process.env.SCHEDULER_SECRET;
  const authHeader = request.headers.get("authorization");

  // In development with no secrets — always allow
  if (!cronSecret && !schedulerSecret && process.env.NODE_ENV === "development") {
    return true;
  }

  if (!authHeader) return false;

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") return false;
  const provided = parts[1];

  // Check against CRON_SECRET (Vercel auto-sets this)
  if (cronSecret) {
    const hashA = createHash("sha256").update(provided).digest();
    const hashB = createHash("sha256").update(cronSecret).digest();
    if (timingSafeEqual(hashA, hashB)) return true;
  }

  // Fallback: check SCHEDULER_SECRET for external callers
  if (schedulerSecret) {
    const hashA = createHash("sha256").update(provided).digest();
    const hashB = createHash("sha256").update(schedulerSecret).digest();
    if (timingSafeEqual(hashA, hashB)) return true;
  }

  return false;
}

async function runFullPipeline(request: NextRequest): Promise<NextResponse> {
  if (!verifyCronSecret(request)) {
    logger.warn("cron_auth_rejected", { endpoint: "/api/cron/scheduler" });
    return NextResponse.json(
      { ok: false, error: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  const pipelineStart = Date.now();

  logger.info("cron_scheduler_triggered", { endpoint: "/api/cron/scheduler" });

  // ── Step 1: Run scheduler ─────────────────────────────────────────────────
  let schedulerResult;
  try {
    schedulerResult = await runScheduler({ dryRun: false });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { ok: false, error: "SCHEDULER_FAILED", detail: msg },
      { status: 500 }
    );
  }

  // ── Step 2: Send claimed steps ────────────────────────────────────────────
  let senderResult = null;
  if (schedulerResult.claimedStepIds.length > 0) {
    try {
      senderResult = await sendBatch(schedulerResult.claimedStepIds);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      // Log but do not fail — scheduler already claimed the steps
      logger.error("cron_sender_failed", { detail: msg, claimedStepIds: schedulerResult.claimedStepIds });
    }
  }

  // ── Step 2.5: Send scheduled Ad-hoc emails ────────────────────────────────
  let sentAdhocEmails = 0;
  try {
    const dueAdhocs = await prisma.adhocEmail.findMany({
      where: {
        status: "PENDING",
        scheduled_at: { lte: new Date() }
      },
      include: {
        prospect: true
      },
      take: 20
    });

    if (dueAdhocs.length > 0) {
      const config = getOAuthConfig();
      if (config) {
        const oauth2Client = createOAuth2Client();
        const gmail = google.gmail({ version: "v1", auth: oauth2Client });

        for (const adhoc of dueAdhocs) {
          try {
            const messagePayload = buildGmailMessage({
              from: config.senderEmail,
              to: adhoc.prospect.email,
              toName: adhoc.prospect.name,
              subject: adhoc.subject,
              body: adhoc.body,
              threadId: adhoc.gmail_thread_id ?? undefined
            });

            const sendResponse = await gmail.users.messages.send({
              userId: "me",
              requestBody: { raw: messagePayload.raw }
            });

            const gmailMessageId = sendResponse.data.id;
            const gmailThreadId = sendResponse.data.threadId;

            if (gmailMessageId) {
              await prisma.adhocEmail.update({
                where: { id: adhoc.id },
                data: {
                  status: "SENT",
                  sent_at: new Date(),
                  gmail_message_id: gmailMessageId,
                  gmail_thread_id: gmailThreadId
                }
              });
              sentAdhocEmails++;
            }
          } catch (error: any) {
            await prisma.adhocEmail.update({
              where: { id: adhoc.id },
              data: {
                status: "FAILED",
                error_message: error.message || "Failed to send scheduled email"
              }
            });
            logger.error("cron_adhoc_send_failed", { detail: error.message, adhocId: adhoc.id });
          }
        }
      }
    }
  } catch (err) {
    logger.error("cron_adhoc_processing_failed", { detail: err instanceof Error ? err.message : String(err) });
  }

  // ── Step 3: Run reply scanner ─────────────────────────────────────────────
  let scannerResult = null;
  try {
    scannerResult = await scanForReplies();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    logger.error("cron_scanner_failed", { detail: msg });
  }

  // ── Step 4: Audit Log Cleanup (1 Month Retention) ─────────────────────────
  let deletedAuditLogs = 0;
  try {
    // We can conditionally run this only once a day if we want, 
    // but running it every cron cycle (15 min) deleting 0-1 rows is harmless and fast.
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    
    // Lazy load service to avoid top-level issues if any
    const { auditService } = await import("@/lib/audit/audit.service");
    // Passing null since system is the actor, and true for isSystem flag
    deletedAuditLogs = await auditService.clearOldLogs(null, oneMonthAgo, true);
  } catch (err) {
    logger.error("cron_audit_cleanup_failed", { detail: err instanceof Error ? err.message : "Unknown error" });
  }

  const totalDurationMs = Date.now() - pipelineStart;

  const response = {
    ok: true,
    runId: schedulerResult.runId,
    candidatesFound: schedulerResult.candidatesFound,
    claimedSteps: schedulerResult.claimedSteps,
    emailsSent: senderResult?.sent ?? 0,
    emailsFailed: senderResult?.failed ?? 0,
    emailsAborted: senderResult?.aborted ?? 0,
    scannerThreadsScanned: scannerResult?.threadsScanned ?? 0,
    scannerRealReplies: scannerResult?.realReplies ?? 0,
    scannerNeedsReview: scannerResult?.needsReview ?? 0,
    schedulerStatus: schedulerResult.status,
    senderStatus: senderResult?.status ?? (schedulerResult.claimedSteps === 0 ? "NO_WORK" : "SKIPPED"),
    scannerStatus: scannerResult?.status ?? "FAILED",
    durationMs: totalDurationMs,
    completedAt: new Date().toISOString(),
  };

  logger.info("cron_scheduler_completed", response as Record<string, any>);

  return NextResponse.json(response);
}

// Vercel Cron sends GET requests; external callers may use POST
export const GET = withObservability(runFullPipeline);
export const POST = withObservability(runFullPipeline);
