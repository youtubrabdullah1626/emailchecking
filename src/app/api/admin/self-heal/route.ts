/**
 * GET /api/admin/self-heal
 *
 * Automated Self-Healing & Cleanup Engine — Phase 3
 *
 * This endpoint is designed to be called by an external cron (e.g. Vercel Cron,
 * GitHub Actions, or an uptime monitor like Better Uptime) on a schedule.
 *
 * Recommended schedule: Every 6 hours.
 *
 * What it does automatically (zero owner intervention required):
 *
 *  1. TOKEN EXPIRY SWEEP   — Finds any EmailAccount whose token_expires_at is
 *     within 24 hours, marks them as NEEDS_RECONNECT, and pauses their sequences
 *     so they don't pile up FAILED email events.
 *
 *  2. ORPHAN CLEANUP       — Deletes EmailAccount rows where connection_status
 *     is DISCONNECTED and last_seen_at is older than 30 days (no activity = dead).
 *
 *  3. STALE SEQUENCE RECOVERY — Finds sequences that have been PAUSED for 14+
 *     days and marks them ARCHIVED so the DB doesn't get cluttered.
 *
 *  4. EXPIRED OAUTH STATES — Cleans the oauth_states table of expired rows
 *     to prevent table bloat.
 *
 * Protected by ADMIN_SECRET or Vercel Cron header.
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyAdminSecret } from "@/lib/auth/admin-auth";
import { logger } from "@/lib/observability/logger";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  // Allow both ADMIN_SECRET and Vercel Cron authorization
  const isVercelCron = request.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`;
  const adminAuth = verifyAdminSecret(request);

  if (!isVercelCron && !adminAuth.authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const report: Record<string, number | string> = {
    startedAt: new Date().toISOString(),
  };

  try {
    // ── 1. TOKEN EXPIRY SWEEP ─────────────────────────────────────────────
    const within24h = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const expiringAccounts = await prisma.emailAccount.findMany({
      where: {
        connection_status: "CONNECTED",
        token_expires_at: { lte: within24h },
      },
      select: { email: true, user_id: true },
    });

    let tokenExpiryCaught = 0;
    for (const account of expiringAccounts) {
      // Mark as NEEDS_RECONNECT to surface in the user's UI
      await prisma.emailAccount.update({
        where: { email: account.email },
        data: { connection_status: "NEEDS_RECONNECT" },
      });

      // Pause all their active sequences to prevent failing sends
      const { count } = await prisma.sequence.updateMany({
        where: { user_id: account.user_id, status: "ACTIVE" },
        data: { status: "PAUSED" },
      });

      tokenExpiryCaught++;
      logger.info("self_heal: token_expiring_soon_paused", {
        email: account.email,
        pausedSequences: count,
      });
    }
    report.tokenExpiryCaught = tokenExpiryCaught;

    // ── 2. ORPHAN CLEANUP ─────────────────────────────────────────────────
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const { count: orphansDeleted } = await prisma.emailAccount.deleteMany({
      where: {
        connection_status: "DISCONNECTED",
        OR: [
          { last_seen_at: { lte: thirtyDaysAgo } },
          { last_seen_at: null, updated_at: { lte: thirtyDaysAgo } },
        ],
      },
    });
    report.orphanAccountsDeleted = orphansDeleted;

    // ── 3. STALE SEQUENCE ARCHIVAL ────────────────────────────────────────
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

    const { count: archivedSequences } = await prisma.sequence.updateMany({
      where: {
        status: "PAUSED",
        stopped_at: { lte: fourteenDaysAgo },
      },
      data: { status: "ARCHIVED" },
    });
    report.staleSequencesArchived = archivedSequences;

    // ── 4. OAUTH STATE CLEANUP ────────────────────────────────────────────
    const { count: expiredStates } = await prisma.oauth_states.deleteMany({
      where: {
        OR: [
          { expires_at: { lte: new Date() } },
          { used: true },
        ],
      },
    });
    report.expiredOAuthStatesDeleted = expiredStates;

    report.completedAt = new Date().toISOString();
    report.status = "OK";

    logger.info("self_heal: completed", report);

    return NextResponse.json({ ok: true, report });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    logger.error("self_heal: failed", { error: msg });
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
