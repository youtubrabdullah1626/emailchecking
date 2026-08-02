/**
 * POST /api/gmail/watch   — Register or renew a Gmail Watch subscription
 * GET  /api/gmail/watch   — Return current watch state and expiry status
 *
 * Gmail Watch registrations expire after at most 7 days. This route must be
 * called periodically (e.g. daily via Vercel Cron) to renew the watch before
 * it expires. The existing 15-min cron scanner covers any gaps during downtime.
 *
 * Authentication:
 *   Protected by SCHEDULER_SECRET (same auth used by other internal endpoints).
 *   In development with no secret configured, access is unrestricted.
 *
 * Prerequisites (one-time Google Cloud setup — documented in gmail.ts):
 *   1. Create a GCP project and enable Pub/Sub + Gmail API
 *   2. Create a PubSub topic: projects/{project}/topics/gmail-replies
 *   3. Grant gmail-api-push@system.gserviceaccount.com "Pub/Sub Publisher" role
 *   4. Create a push subscription with endpoint:
 *      https://yourdomain.com/api/webhooks/gmail?token={GMAIL_WEBHOOK_SECRET}
 *   5. Set GMAIL_PUBSUB_TOPIC and GMAIL_WEBHOOK_SECRET in environment
 *
 * Environment variables required:
 *   GMAIL_PUBSUB_TOPIC      — Full PubSub topic name
 *                             e.g. "projects/my-project/topics/gmail-replies"
 *   GMAIL_WEBHOOK_SECRET    — Token embedded in the push subscription URL
 *   SCHEDULER_SECRET        — Auth secret for this internal endpoint
 */

import { NextRequest, NextResponse } from "next/server";
import {
  registerGmailWatch,
  stopGmailWatch,
  GmailTrackerError,
} from "@/lib/reply-tracker/gmail";
import { saveWatchState, getWatchState } from "@/lib/reply-tracker/repository";
import { verifySchedulerSecret, unauthorizedResponse } from "@/lib/auth/scheduler-auth";
import { getOAuthConfig } from "@/lib/gmail/oauth";

// Renew the watch when less than this many ms remain before expiry (1 day buffer)
const RENEWAL_BUFFER_MS = 24 * 60 * 60 * 1000;

// ── GET /api/gmail/watch ──────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  const isSameOrigin =
    request.headers.get("sec-fetch-site") === "same-origin" ||
    request.headers.get("sec-fetch-site") === "same-site" ||
    process.env.NODE_ENV === "development";

  if (!isSameOrigin) {
    const auth = verifySchedulerSecret(request);
    if (!auth.authorized) return unauthorizedResponse(auth.reason);
  }

  const { listAllAccountHealth } = await import("@/lib/reply-tracker/health-monitor");
  const accounts = await listAllAccountHealth();

  return NextResponse.json({
    ok: true,
    totalAccounts: accounts.length,
    accounts,
  });
}

// ── POST /api/gmail/watch ─────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  const isSameOrigin =
    request.headers.get("sec-fetch-site") === "same-origin" ||
    request.headers.get("sec-fetch-site") === "same-site" ||
    process.env.NODE_ENV === "development";

  if (!isSameOrigin) {
    const auth = verifySchedulerSecret(request);
    if (!auth.authorized) return unauthorizedResponse(auth.reason);
  }

  const { runSystemWideSelfHealing, autoRepairAccount } = await import(
    "@/lib/reply-tracker/health-monitor"
  );

  let body: { email?: string } = {};
  try {
    body = await request.json();
  } catch {
    // Empty body is allowed
  }

  if (body.email) {
    const result = await autoRepairAccount(body.email);
    return NextResponse.json({ ok: true, repair: result });
  }

  const sweepResults = await runSystemWideSelfHealing();
  return NextResponse.json({
    ok: true,
    message: "System-wide watch renewal sweep completed.",
    accountsProcessed: sweepResults.length,
    results: sweepResults,
  });
}
