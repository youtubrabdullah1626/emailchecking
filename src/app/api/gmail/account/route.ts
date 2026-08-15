/**
 * GET & POST /api/gmail/account
 *
 * Multi-User Connected Account Management API Endpoint
 *
 * Powers the ConnectedAccountCard component and 1-click account actions:
 *   - Test Connection
 *   - Renew Watch
 *   - Sync Now
 *   - Disconnect
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  getAccountHealthSummary,
  listAllAccountHealth,
  autoRepairAccount,
} from "@/lib/reply-tracker/health-monitor";
import { disconnectAccount } from "@/lib/gmail/oauth";
import { getCurrentHistoryId } from "@/lib/reply-tracker/gmail";
import { scanForReplies } from "@/lib/reply/scanner";
import { verifySchedulerSecret, unauthorizedResponse } from "@/lib/auth/scheduler-auth";
import { auditService } from "@/lib/audit/audit.service";
import { getSession } from "@/lib/auth/session";
import { getTenantPrisma } from "@/lib/db/tenant-prisma";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const isSameOrigin =
    request.headers.get("sec-fetch-site") === "same-origin" ||
    request.headers.get("sec-fetch-site") === "same-site" ||
    process.env.NODE_ENV === "development";

  if (!isSameOrigin) {
    const auth = verifySchedulerSecret(request);
    if (!auth.authorized) return unauthorizedResponse(auth.reason);
  }

  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const tenantPrisma = getTenantPrisma(session.user.id);

    // Fetch user's configured timezone
    const userRecord = await prisma.users.findUnique({
      where: { id: session.user.id },
      select: { timezone: true },
    });
    const userTimezone = userRecord?.timezone || "UTC";
    const { getStartOfDayInTimezone } = await import("@/lib/date-utils");
    const startOfDay = getStartOfDayInTimezone(userTimezone);

    // Only fetch accounts belonging to the authenticated user
    const userAccounts = await tenantPrisma.emailAccount.findMany({
      select: { 
        email: true, 
        sent_today: true, 
        health_score: true, 
        connection_status: true,
        created_at: true,
        warmup_status: true,
        daily_limit: true,
      }
    });

    const healthSummaries = await listAllAccountHealth();

    const accountDetails = await Promise.all(
      userAccounts.map(async (account) => {
        const summary = healthSummaries.find(h => h.email === account.email) || {
          email: account.email,
          healthStatus: account.connection_status === "CONNECTED" ? "HEALTHY" : "DISCONNECTED",
          errorCount: 0,
        };

        const now = new Date();
        const created = account.created_at || now;
        const ageInDays = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
        
        // Cold outreach safe baseline limit: 50 emails/day per mailbox
        const baseLimit = account.daily_limit && account.daily_limit <= 100 ? account.daily_limit : 50;
        
        let dailyLimit = baseLimit;
        let warmupStage: "DAY_1_3" | "DAY_4_7" | "MATURE" | "COMPLETED" = "MATURE";

        if (account.warmup_status === "COMPLETED") {
          dailyLimit = baseLimit;
          warmupStage = "COMPLETED";
        } else if (ageInDays <= 2) {
          dailyLimit = Math.min(baseLimit, 10);
          warmupStage = "DAY_1_3";
        } else if (ageInDays <= 6) {
          dailyLimit = Math.min(baseLimit, 25);
          warmupStage = "DAY_4_7";
        }

        // Live real-time sent count for today (single source of truth)
        const normalizedEmail = account.email.toLowerCase();
        const actualSentToday = await prisma.emailEvent.count({
          where: {
            event_type: "SENT",
            occurred_at: { gte: startOfDay },
            step: {
              sequence: {
                user_id: session.user.id,
                assigned_sender_email: normalizedEmail,
              }
            }
          }
        }).catch(() => 0);

        return {
          ...summary,
          sentToday: actualSentToday,
          dailyLimit,
          warmupStage,
          warmupStatus: account.warmup_status || "PENDING",
          ageInDays,
          replyCount: 0,
          lastEmailSentAt: null,
          lastReplyDetectedAt: null,
          healthScore: account?.health_score || (summary.healthStatus === "HEALTHY" ? 100 : summary.healthStatus === "EXPIRING_SOON" ? 85 : 40),
        };
      })
    );

    return NextResponse.json({ ok: true, accounts: accountDetails });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to load connected accounts.";
    return NextResponse.json(
      { ok: false, error: "LOAD_FAILED", detail: msg },
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

  let body: { email?: string; action?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const email = body.email || process.env.GMAIL_SENDER_EMAIL;
  const action = body.action;

  if (!email) {
    return NextResponse.json({ error: "Missing account email parameter." }, { status: 400 });
  }

  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const tenantPrisma = getTenantPrisma(session.user.id);

  // Strict Tenant Isolation: Ensure the user actually owns this email account before acting on it
  const account = await tenantPrisma.emailAccount.findUnique({ where: { email } });
  if (!account) {
    return NextResponse.json({ error: "Unauthorized: Account not found or belongs to another user." }, { status: 403 });
  }

  try {
    if (action === "TEST_CONNECTION") {
      const historyId = await getCurrentHistoryId(email);
      return NextResponse.json({
        ok: true,
        action: "TEST_CONNECTION",
        message: `Connection successful! Verified Gmail OAuth access. Current History ID: ${historyId}.`,
      });
    }

    if (action === "RENEW_WATCH") {
      const repair = await autoRepairAccount(email);
      return NextResponse.json({
        ok: true,
        action: "RENEW_WATCH",
        message: repair.message,
        repair,
      });
    }

    if (action === "SYNC_NOW") {
      const scanResult = await scanForReplies();
      return NextResponse.json({
        ok: true,
        action: "SYNC_NOW",
        message: `Sync complete. Scanned ${scanResult.threadsScanned} thread(s). Found ${scanResult.realReplies} real reply(ies).`,
        scanResult,
      });
    }

    if (action === "DISCONNECT") {
      await disconnectAccount(email);
      
      auditService.logAction(
        session.user.id,
        session.user.email,
        'GMAIL_DISCONNECTED',
        'AUTHENTICATION',
        `Gmail (${email})`,
        'Email Account',
        'SUCCESS',
        { metadata: { email } }
      );
      
      return NextResponse.json({
        ok: true,
        action: "DISCONNECT",
        message: `Successfully disconnected account ${email}.`,
      });
    }

    if (action === "DELETE_ACCOUNT") {
      // Gracefully clear sticky lock on any active sequences so they dynamically fall back to remaining inboxes
      await prisma.sequence.updateMany({
        where: { user_id: session.user.id, assigned_sender_email: email },
        data: { assigned_sender_email: null }
      }).catch(() => {});

      await tenantPrisma.emailAccount.deleteMany({ where: { email } });
      await prisma.gmailWatchState.deleteMany({ where: { email } });
      
      auditService.logAction(
        session.user.id,
        session.user.email,
        'GMAIL_DELETED',
        'AUTHENTICATION',
        `Gmail (${email})`,
        'Email Account',
        'SUCCESS',
        { metadata: { email } }
      );
      
      return NextResponse.json({
        ok: true,
        action: "DELETE_ACCOUNT",
        message: `Successfully deleted account ${email}.`,
      });
    }

    return NextResponse.json({ error: `Unknown action "${action}".` }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Account action failed.";
    return NextResponse.json(
      { ok: false, error: "ACTION_FAILED", detail: msg },
      { status: 500 }
    );
  }
}
