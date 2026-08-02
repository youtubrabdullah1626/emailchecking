/**
 * GET & POST /api/gmail/health
 *
 * Multi-User SaaS Connection Health Monitor & Automated Self-Healing API Endpoint
 *
 * GET:
 *   Returns real-time health summaries across all connected Gmail accounts in the SaaS.
 *   Reports connection status (CONNECTED/NEEDS_RECONNECT), watch health (HEALTHY/EXPIRING_SOON/EXPIRED),
 *   expiry countdowns, and self-healing action flags.
 *
 * POST:
 *   Triggers immediate automated self-healing repair on a specific account or system-wide.
 *   Renews watches, resyncs expired history cursors, and resets error thresholds automatically.
 *
 * Server-side only. Protected by SCHEDULER_SECRET (or same-origin browser UI session).
 */

import { NextRequest, NextResponse } from "next/server";
import {
  listAllAccountHealth,
  getAccountHealthSummary,
  autoRepairAccount,
  runSystemWideSelfHealing,
} from "@/lib/reply-tracker/health-monitor";
import { verifySchedulerSecret, unauthorizedResponse } from "@/lib/auth/scheduler-auth";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const isSameOrigin =
    request.headers.get("sec-fetch-site") === "same-origin" ||
    request.headers.get("sec-fetch-site") === "same-site" ||
    process.env.NODE_ENV === "development";

  if (!isSameOrigin) {
    const auth = verifySchedulerSecret(request);
    if (!auth.authorized) return unauthorizedResponse(auth.reason);
  }

  const emailParam = request.nextUrl.searchParams.get("email");

  try {
    if (emailParam) {
      const summary = await getAccountHealthSummary(emailParam);
      return NextResponse.json({ ok: true, account: summary });
    }

    const summaries = await listAllAccountHealth();

    const healthyCount = summaries.filter((s) => s.healthStatus === "HEALTHY").length;
    const expiringCount = summaries.filter((s) => s.healthStatus === "EXPIRING_SOON").length;
    const expiredCount = summaries.filter((s) => s.healthStatus === "EXPIRED").length;
    const reconnectCount = summaries.filter((s) => s.healthStatus === "NEEDS_RECONNECT").length;

    return NextResponse.json({
      ok: true,
      totalAccounts: summaries.length,
      healthyCount,
      expiringCount,
      expiredCount,
      reconnectCount,
      accounts: summaries,
      systemHealth: reconnectCount > 0 ? "ATTENTION_NEEDED" : expiredCount > 0 ? "DEGRADED" : "HEALTHY",
      capturedAt: new Date().toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to load account health.";
    return NextResponse.json(
      { ok: false, error: "HEALTH_CHECK_FAILED", detail: msg },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const isSameOrigin =
    request.headers.get("sec-fetch-site") === "same-origin" ||
    request.headers.get("sec-fetch-site") === "same-site" ||
    process.env.NODE_ENV === "development";

  if (!isSameOrigin) {
    const auth = verifySchedulerSecret(request);
    if (!auth.authorized) return unauthorizedResponse(auth.reason);
  }

  let body: { email?: string; systemWide?: boolean } = {};
  try {
    body = await request.json();
  } catch {
    // Empty body is allowed — defaults to system-wide repair sweep
  }

  try {
    if (body.email) {
      const repairResult = await autoRepairAccount(body.email);
      return NextResponse.json({ ok: true, repair: repairResult });
    }

    const sweepResults = await runSystemWideSelfHealing();
    return NextResponse.json({
      ok: true,
      accountsRepaired: sweepResults.length,
      results: sweepResults,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Self-healing repair failed.";
    return NextResponse.json(
      { ok: false, error: "REPAIR_FAILED", detail: msg },
      { status: 500 }
    );
  }
}
