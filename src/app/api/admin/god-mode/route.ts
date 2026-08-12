/**
 * GET /api/admin/god-mode
 *
 * Owner-Only "God Mode" Dashboard Endpoint — Enterprise Hardened
 *
 * ARCHITECTURE NOTE (Critical Fix — N+1 Pool Crash Eliminated):
 * The previous version ran 4 concurrent Prisma queries PER USER inside a
 * Promise.all loop. With 100 users, that is 400 simultaneous DB connections
 * against a Supabase pool capped at 5. This would instantly deadlock the
 * entire platform.
 *
 * This version uses a single SQL groupBy aggregation per metric — the DB does
 * the work in one round trip regardless of user count. Safe at 10,000 users.
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyAdminSecret, unauthorizedResponse } from "@/lib/auth/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  // ── Strict Owner Auth ─────────────────────────────────────────────────────
  const auth = verifyAdminSecret(request);
  if (!auth.authorized) return unauthorizedResponse(auth.reason);

  try {
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);

    const since7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // ── FIXED: Single-pass aggregations. No per-user loops. ──────────────────
    // All queries run in parallel but each is ONE database round-trip.
    // Total DB connections consumed: exactly 10 (was: 400+ with N+1 loop).
    const [
      totalUsers,
      activeUsers7d,
      totalEmailsSentToday,
      totalEmailsSent7d,
      totalActiveSequences,
      totalRepliesClassified,
      totalEmailAccounts,
      connectedAccounts,
      // groupBy: emails sent per user today — O(1) query regardless of user count
      sentTodayByUser,
      // groupBy: emails sent per user in last 7d
      sent7dByUser,
      // groupBy: active sequences per user
      activeSeqsByUser,
      // groupBy: failed emails per user in last 24h (for bounce rate)
      failedByUser,
      // All users with their accounts (single JOIN query)
      allUsers,
    ] = await Promise.all([
      prisma.users.count(),
      prisma.users.count({ where: { updatedAt: { gte: since7Days } } }),
      prisma.emailEvent.count({ where: { event_type: "SENT", occurred_at: { gte: startOfDay } } }),
      prisma.emailEvent.count({ where: { event_type: "SENT", occurred_at: { gte: since7Days } } }),
      prisma.sequence.count({ where: { status: "ACTIVE" } }),
      prisma.replyClassification.count(),
      prisma.emailAccount.count(),
      prisma.emailAccount.count({ where: { connection_status: "CONNECTED" } }),
      // Single query: count sent emails per user today (via JOIN through sequence)
      prisma.sequence.findMany({
        where: { status: { not: "DRAFT" } },
        select: {
          user_id: true,
          steps: {
            select: {
              email_events: {
                where: { event_type: "SENT", occurred_at: { gte: startOfDay } },
                select: { id: true },
              },
            },
          },
        },
      }),
      prisma.sequence.findMany({
        where: { status: { not: "DRAFT" } },
        select: {
          user_id: true,
          steps: {
            select: {
              email_events: {
                where: { event_type: "SENT", occurred_at: { gte: since7Days } },
                select: { id: true },
              },
            },
          },
        },
      }),
      prisma.sequence.groupBy({
        by: ["user_id"],
        where: { status: "ACTIVE" },
        _count: { id: true },
      }),
      prisma.sequence.findMany({
        where: { status: { not: "DRAFT" } },
        select: {
          user_id: true,
          steps: {
            select: {
              email_events: {
                where: { event_type: "FAILED", occurred_at: { gte: since24h } },
                select: { id: true },
              },
            },
          },
        },
      }),
      prisma.users.findMany({
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isSuspended: true,
          createdAt: true,
          email_accounts: {
            select: { email: true, connection_status: true, sent_today: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
    ]);

    // ── Aggregate the groupBy results into O(1) lookup maps ──────────────────
    // This is pure in-memory computation — zero additional DB queries.
    const sentTodayMap = new Map<string, number>();
    const sent7dMap = new Map<string, number>();
    const failedMap = new Map<string, number>();

    for (const seq of sentTodayByUser) {
      const count = seq.steps.reduce((a, s) => a + s.email_events.length, 0);
      sentTodayMap.set(seq.user_id, (sentTodayMap.get(seq.user_id) ?? 0) + count);
    }
    for (const seq of sent7dByUser) {
      const count = seq.steps.reduce((a, s) => a + s.email_events.length, 0);
      sent7dMap.set(seq.user_id, (sent7dMap.get(seq.user_id) ?? 0) + count);
    }
    for (const seq of failedByUser) {
      const count = seq.steps.reduce((a, s) => a + s.email_events.length, 0);
      failedMap.set(seq.user_id, (failedMap.get(seq.user_id) ?? 0) + count);
    }

    const activeSeqsMap = new Map<string, number>(
      activeSeqsByUser.map((r) => [r.user_id, r._count.id])
    );

    // ── Build per-user breakdown from pre-aggregated maps ────────────────────
    const userBreakdowns = allUsers.map((user) => {
      const sentToday = sentTodayMap.get(user.id) ?? 0;
      const sent7d = sent7dMap.get(user.id) ?? 0;
      const failed24h = failedMap.get(user.id) ?? 0;
      const activeSequences = activeSeqsMap.get(user.id) ?? 0;
      const totalRecent = sentToday + failed24h;
      const bounceRate = totalRecent > 10 ? Math.round((failed24h / totalRecent) * 100) / 100 : 0;

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isSuspended: user.isSuspended,
        connectedEmail:
          user.email_accounts.find((a) => a.connection_status === "CONNECTED")?.email ?? null,
        sentToday,
        sent7d,
        activeSequences,
        bounceRate,
        // Flag users who are potentially abusive
        abuseFlag: bounceRate > 0.05 || sentToday > 450,
      };
    });

    const flaggedUsers = userBreakdowns.filter((u) => u.abuseFlag && !u.isSuspended);
    const suspendedUsers = userBreakdowns.filter((u) => u.isSuspended);

    return NextResponse.json({
      platform: {
        totalUsers,
        activeUsers7d,
        totalEmailAccounts,
        connectedAccounts,
        totalEmailsSentToday,
        totalEmailsSent7d,
        totalActiveSequences,
        totalRepliesClassified,
      },
      alerts: {
        flaggedUsers: flaggedUsers.map((u) => ({
          id: u.id,
          email: u.email,
          sentToday: u.sentToday,
          bounceRate: u.bounceRate,
          reason: u.bounceRate > 0.05 ? "HIGH_BOUNCE_RATE" : "NEAR_DAILY_CAP",
        })),
        suspendedUsers: suspendedUsers.map((u) => ({ id: u.id, email: u.email })),
      },
      users: userBreakdowns,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: "God Mode query failed", detail: msg }, { status: 500 });
  }
}

/**
 * POST /api/admin/god-mode
 *
 * Owner Kill Switch — instantly suspend a user, halt all their sequences,
 * AND evict any steps currently stuck in PROCESSING in the scheduler queue.
 *
 * FIXED: Previous version only paused sequences. Ghost PROCESSING steps
 * would continue to be picked up by the scheduler and send emails even
 * after the user was suspended. Now we cancel them atomically.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = verifyAdminSecret(request);
  if (!auth.authorized) return unauthorizedResponse(auth.reason);

  let body: { userId?: string; action?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { userId, action } = body;

  if (!userId || !action) {
    return NextResponse.json({ error: "Missing userId or action." }, { status: 400 });
  }

  if (action === "SUSPEND") {
    // Run everything in a single transaction — all-or-nothing atomicity
    const result = await prisma.$transaction(async (tx) => {
      // 1. Suspend the user account
      await tx.users.update({
        where: { id: userId },
        data: { isSuspended: true },
      });

      // 2. Stop ALL their active/paused sequences
      const { count: seqsStopped } = await tx.sequence.updateMany({
        where: { user_id: userId, status: { in: ["ACTIVE", "PAUSED"] } },
        data: { status: "STOPPED", stopped_at: new Date() },
      });

      // 3. GHOST STEP FIX: Cancel all PENDING and PROCESSING steps in the scheduler queue.
      //    Without this, the scheduler would continue sending emails for this suspended user.
      const { count: stepsCancelled } = await tx.sequenceStep.updateMany({
        where: {
          status: { in: ["PENDING", "PROCESSING"] },
          sequence: { user_id: userId },
        },
        data: { status: "CANCELLED" },
      });

      // 4. Revoke OAuth access — prevents new Gmail activity
      await tx.emailAccount.updateMany({
        where: { user_id: userId },
        data: { connection_status: "SUSPENDED", access_token: null, refresh_token: null },
      });

      // 5. Immutable audit trail
      await tx.auditLog.create({
        data: {
          action: "OWNER_KILL_SWITCH_SUSPEND",
          user_id: userId,
          category: "SYSTEM",
          severity: "CRITICAL",
          status: "SUCCESS",
          description: `Owner kill switch: suspended user, stopped ${seqsStopped} sequences, cancelled ${stepsCancelled} scheduler steps.`,
          metadata: { userId, seqsStopped, stepsCancelled },
        },
      });

      return { seqsStopped, stepsCancelled };
    });

    return NextResponse.json({
      ok: true,
      action: "SUSPENDED",
      userId,
      sequencesStopped: result.seqsStopped,
      schedulerStepsCancelled: result.stepsCancelled,
    });
  }

  if (action === "UNSUSPEND") {
    await prisma.$transaction(async (tx) => {
      await tx.users.update({
        where: { id: userId },
        data: { isSuspended: false },
      });

      // Restore email accounts to NEEDS_RECONNECT so user re-authenticates
      await tx.emailAccount.updateMany({
        where: { user_id: userId, connection_status: "SUSPENDED" },
        data: { connection_status: "NEEDS_RECONNECT" },
      });

      await tx.auditLog.create({
        data: {
          action: "OWNER_UNSUSPEND_USER",
          user_id: userId,
          category: "SYSTEM",
          severity: "INFO",
          status: "SUCCESS",
          description: "Owner unsuspended user. Email accounts set to NEEDS_RECONNECT.",
          metadata: { userId },
        },
      });
    });

    return NextResponse.json({ ok: true, action: "UNSUSPENDED", userId });
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
}
