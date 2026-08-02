/**
 * GET /api/reliability/health
 *
 * System Reliability & Self-Healing Status API Endpoint
 *
 * Returns real-time metrics from the reliability engine:
 *   - Connected account health summaries
 *   - Gmail Watch expiry countdowns
 *   - Circuit breaker states (in-memory)
 *   - OAuth connection statuses
 *   - Recent auto-healing events
 *   - System-wide failure counts
 *
 * POST /api/reliability/health
 *   Triggers a system-wide self-healing sweep immediately.
 */

import { NextRequest, NextResponse } from "next/server";
import { listAllAccountHealth, runSystemWideSelfHealing } from "@/lib/reply-tracker/health-monitor";
import { verifySchedulerSecret, unauthorizedResponse } from "@/lib/auth/scheduler-auth";

function isSameOrigin(request: NextRequest): boolean {
  return (
    request.headers.get("sec-fetch-site") === "same-origin" ||
    request.headers.get("sec-fetch-site") === "same-site" ||
    process.env.NODE_ENV === "development"
  );
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isSameOrigin(request)) {
    const auth = verifySchedulerSecret(request);
    if (!auth.authorized) return unauthorizedResponse(auth.reason);
  }

  try {
    const accounts = await listAllAccountHealth();

    const summary = {
      totalAccounts: accounts.length,
      healthy: accounts.filter((a) => a.healthStatus === "HEALTHY").length,
      expiringSoon: accounts.filter((a) => a.healthStatus === "EXPIRING_SOON").length,
      expired: accounts.filter((a) => a.healthStatus === "EXPIRED").length,
      needsReconnect: accounts.filter((a) => a.healthStatus === "NEEDS_RECONNECT").length,
      disconnected: accounts.filter((a) => a.healthStatus === "DISCONNECTED").length,
    };

    const overallStatus =
      summary.needsReconnect > 0
        ? "NEEDS_ATTENTION"
        : summary.expired > 0
        ? "DEGRADED"
        : summary.expiringSoon > 0
        ? "WARNING"
        : "HEALTHY";

    return NextResponse.json({
      ok: true,
      overallStatus,
      summary,
      accounts: accounts.map((a) => ({
        email: a.email,
        healthStatus: a.healthStatus,
        connectionStatus: a.connectionStatus,
        historyId: a.historyId,
        expiresAt: a.expiresAt,
        msUntilExpiry: a.msUntilExpiry,
        needsWatchRenewal: a.needsWatchRenewal,
        errorCount: a.errorCount,
        lastError: a.lastError,
        lastSyncedAt: a.lastSyncedAt,
        autoHealedAt: a.autoHealedAt,
      })),
      reliabilityEngine: {
        retryPolicy: "exponential-backoff-with-jitter",
        maxRetries: 3,
        initialDelayMs: 500,
        circuitBreakerThreshold: 5,
        circuitBreakerResetMs: 600_000,
        rateLimitPerMinute: 60,
      },
      capturedAt: new Date().toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to load reliability metrics.";
    return NextResponse.json({ ok: false, error: "RELIABILITY_CHECK_FAILED", detail: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isSameOrigin(request)) {
    const auth = verifySchedulerSecret(request);
    if (!auth.authorized) return unauthorizedResponse(auth.reason);
  }

  try {
    const results = await runSystemWideSelfHealing();

    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return NextResponse.json({
      ok: true,
      message: `Self-healing sweep complete. ${succeeded} account(s) repaired, ${failed} failed.`,
      results,
      capturedAt: new Date().toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Self-healing sweep failed.";
    return NextResponse.json({ ok: false, error: "SELF_HEAL_FAILED", detail: msg }, { status: 500 });
  }
}
