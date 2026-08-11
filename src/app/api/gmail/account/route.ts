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
import { getSessionUser } from "@/lib/audit/rbac";

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
    const healthSummaries = await listAllAccountHealth();

    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);

    const accountDetails = await Promise.all(
      healthSummaries.map(async (summary) => {
        const account = await prisma.emailAccount.findUnique({
          where: { email: summary.email },
          select: { sent_today: true, health_score: true },
        });

        return {
          ...summary,
          sentToday: account?.sent_today || 0,
          replyCount: 0, // Simplified to avoid slow counts
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
      
      const user = await getSessionUser();
      auditService.logAction(
        user?.id || 'system',
        user?.email || 'system',
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
      await prisma.emailAccount.deleteMany({ where: { email } });
      await prisma.gmailWatchState.deleteMany({ where: { email } });
      
      const user = await getSessionUser();
      auditService.logAction(
        user?.id || 'system',
        user?.email || 'system',
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
