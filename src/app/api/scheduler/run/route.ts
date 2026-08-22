export const dynamic = "force-dynamic";
/**
 * API Route — POST /api/scheduler/run
 *
 * Executes one scheduler run and returns a structured result.
 *
 * INTERNAL DEVELOPMENT ENDPOINT — Phase 4
 *
 * ⚠ This endpoint is intentionally unprotected in Phase 4.
 *    The system has no authentication yet (single-user personal tool).
 *    In Phase 5+, this endpoint must be protected before any real email
 *    sending is connected, to prevent external actors from triggering sends.
 *
 * Usage (local development):
 *   POST http://localhost:3000/api/scheduler/run
 *   POST http://localhost:3000/api/scheduler/run?dryRun=true
 *
 * Query parameters:
 *   dryRun=true    — validate and identify due steps, but do NOT claim them
 *   maxClaims=N    — maximum steps to claim in this run (default 50)
 *
 * Response 200:
 *   {
 *     "runId": "...",
 *     "candidatesFound": 3,
 *     "claimedSteps": 3,
 *     "claimedStepIds": ["..."],
 *     "status": "SUCCESS",
 *     ... (full SchedulerRunResult)
 *   }
 *
 * The response NEVER contains:
 *   - database connection strings
 *   - API keys or secrets
 *   - full email body content
 *   - personal data beyond prospect name/ID for traceability
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/nextauth";
import { runScheduler } from "@/lib/scheduler/run";
import { verifySchedulerSecret, unauthorizedResponse } from "@/lib/auth/scheduler-auth";
import { withObservability } from "@/lib/observability/middleware";
import { logger } from "@/lib/observability/logger";
import prisma from "@/lib/prisma";

export const POST = withObservability(async (request: NextRequest) => {
  // ── Authentication guard ──────────────────────────────────────────────────
  const host = request.headers.get("host");
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const secFetchSite = request.headers.get("sec-fetch-site");

  const isBrowserRequest = (origin && host && origin.includes(host)) || 
                           (referer && host && referer.includes(host)) ||
                           secFetchSite === "same-origin" || 
                           secFetchSite === "same-site" ||
                           process.env.NODE_ENV === "development";

  let isAuthorized = isBrowserRequest;
  if (!isAuthorized) {
    const session = await getServerSession(authOptions).catch(() => null);
    if (session?.user) {
      isAuthorized = true;
    }
  }

  if (!isAuthorized) {
    const auth = verifySchedulerSecret(request);
    if (!auth.authorized) return unauthorizedResponse(auth.reason);
  }

  const { searchParams } = new URL(request.url);

  // Parse dry-run flag (default: false — real claiming)
  // Check body first, then fallback to searchParams
  let dryRun = searchParams.get("dryRun") === "true";
  let maxClaims = 50;

  try {
    const body = await request.json().catch(() => ({}));
    if (typeof body.dryRun === "boolean") dryRun = body.dryRun;
    if (typeof body.maxClaims === "number") maxClaims = body.maxClaims;
  } catch {
    // Ignore JSON parse errors
  }

  // Parse maxClaims (default: 50, capped at 200 to prevent runaway)
  const rawMax = searchParams.get("maxClaims");
  if (rawMax) {
    maxClaims = Math.min(Math.max(parseInt(rawMax, 10) || 50, 1), 200);
  }

  try {
    // Auto-recover any DELAYED steps whose cooldown/retry time has elapsed
    if (!dryRun) {
      await prisma.sequenceStep.updateMany({
        where: {
          status: "DELAYED",
          retry_at: { lte: new Date() },
          sequence: { status: "ACTIVE" },
        },
        data: {
          status: "PENDING",
          delay_reason: null,
          retry_at: null,
        },
      }).catch(() => {});
    }

    const result = await runScheduler({ dryRun, maxClaims });
    
    // Actually send the sequence emails if not a dry run and steps were claimed
    if (!dryRun && result.claimedStepIds.length > 0) {
      const { sendBatch } = await import("@/lib/gmail/sender");
      try {
        await sendBatch(result.claimedStepIds);
      } catch (err) {
        logger.error("Failed to send batch after manual scheduler run", { error: err });
      }
    }

    // Also process any due scheduled adhoc composer emails
    if (!dryRun) {
      const { sendDueAdhocEmails } = await import("@/lib/gmail/adhoc-sender");
      await sendDueAdhocEmails(50).catch(err => {
        logger.error("Failed to process due adhoc emails during scheduler run", { error: err });
      });
    }
    
    // Log the run in AuditLog so we have a precise "Last Run" timestamp
    if (!dryRun) {
      await prisma.auditLog.create({
        data: {
          action_type: "SYSTEM_ACTION",
          action: "SCHEDULER_RUN",
          metadata: {
            candidatesFound: result.candidatesFound,
            claimedSteps: result.claimedSteps,
            durationMs: result.durationMs,
          }
        }
      }).catch(err => logger.error("Failed to write audit log", { error: err }));
    }
    
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected scheduler failure";
    logger.error("Unhandled scheduler error", { error: message });
    return NextResponse.json(
      { error: "Scheduler failed to execute.", detail: message },
      { status: 500 }
    );
  }
});

// Only POST is supported — reject other methods
export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed. Use POST to trigger a scheduler run." },
    { status: 405 }
  );
}

