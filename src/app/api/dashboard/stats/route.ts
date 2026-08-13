export const dynamic = "force-dynamic";
/**
 * GET /api/dashboard/stats
 *
 * Operational Dashboard Statistics & System Health Endpoint — Phase 11
 *
 * Returns real database-derived operational metrics:
 *   - Active sequences count
 *   - Emails sent today count
 *   - Total real replies count
 *   - Pending operator reviews count
 *   - Failed steps count
 *   - Recently stopped sequences count
 *   - Recent activity timeline
 *   - Scheduler health (from getSchedulerHealth())
 *   - System configuration status
 *
 * All values are computed from real PostgreSQL data. No fake data.
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getTenantPrisma } from "@/lib/db/tenant-prisma";
import { getSession } from "@/lib/auth/session";
import { getSchedulerHealth } from "@/lib/scheduler/health";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const tenantPrisma = getTenantPrisma(session.user.id);
    const userId = session.user.id;

    // Use the client's exact local midnight if provided, otherwise fallback to UTC midnight
    const localStartStr = req.headers.get('x-local-start-of-day');
    let startOfDay = new Date();
    if (localStartStr && !isNaN(Date.parse(localStartStr))) {
      startOfDay = new Date(localStartStr);
    } else {
      startOfDay.setUTCHours(0, 0, 0, 0);
    }

    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);

    const [
      activeSequences,
      sequenceEmailsSentToday,
      adhocEmailsSentToday,
      repliesToday,
      pendingReviews,
      failedSteps,
      stoppedSequences,
      recentEmailEvents,
      recentRepliesEvents,
      recentAudits,
      schedulerHealth,
      emailAccount,
      dailyLimitConfig,
      hourlyLimitConfig,
      sequenceLimitConfig,
      bannerThemeConfig,
      emailsSentThisHour,
    ] = await Promise.all([
      tenantPrisma.sequence.count({ where: { status: "ACTIVE" } }),
      prisma.emailEvent.count({
        where: {
          event_type: "SENT",
          occurred_at: { gte: startOfDay },
          step: { sequence: { user_id: userId } }
        },
      }),
      prisma.adhocEmail.count({
        where: {
          sent_at: { gte: startOfDay },
          prospect: { user_id: userId }
        },
      }),
      prisma.replyClassification.count({
        where: { 
          reply_type: "REAL_REPLY",
          classified_at: { gte: startOfDay },
          prospect: { user_id: userId }
        },
      }),
      prisma.replyClassification.count({
        where: {
          reply_type: "NEEDS_REVIEW",
          review_status: "PENDING",
          prospect: { user_id: userId }
        },
      }),
      prisma.sequenceStep.count({ 
        where: { 
          status: "FAILED",
          sequence: { user_id: userId }
        } 
      }),
      tenantPrisma.sequence.count({ where: { status: "STOPPED" } }),
      prisma.emailEvent.findMany({
        take: 20,
        orderBy: { occurred_at: "desc" },
        where: { step: { sequence: { user_id: userId } } },
        include: {
          step: {
            select: {
              step_number: true,
              subject: true,
              sequence: {
                select: { prospect: { select: { name: true, company: true } } }
              }
            }
          }
        }
      }),
      prisma.replyClassification.findMany({
        take: 10,
        orderBy: { classified_at: "desc" },
        where: { prospect: { user_id: userId } },
        include: { prospect: { select: { name: true, company: true } } }
      }),
      prisma.auditLog.findMany({
        take: 10,
        orderBy: { created_at: "desc" },
        where: { user_id: userId }
      }),
      getSchedulerHealth(),
      tenantPrisma.emailAccount.findFirst({
        orderBy: { updated_at: "desc" },
        select: { email: true, connection_status: true }
      }),
      prisma.platform_configs.findFirst({
        where: { key: "MAX_DAILY_EMAILS" }
      }),
      prisma.platform_configs.findFirst({
        where: { key: "HOURLY_EMAIL_LIMIT" }
      }),
      prisma.platform_configs.findFirst({
        where: { key: "MAX_ACTIVE_SEQUENCES" }
      }),
      prisma.platform_configs.findFirst({
        where: { key: "BANNER_THEME" }
      }),
      prisma.emailEvent.count({
        where: {
          event_type: "SENT",
          occurred_at: { gte: oneHourAgo },
          step: { sequence: { user_id: userId } }
        },
      }),
    ]);

    const formattedEmailEvents = recentEmailEvents
      .filter((evt) => evt.step?.sequence?.prospect != null)
      .map((evt) => ({
        id: evt.id,
        eventType: evt.event_type,
        occurredAt: evt.occurred_at.toISOString(),
        prospectName: evt.step.sequence.prospect.name,
        company: evt.step.sequence.prospect.company,
        details: evt.step.subject,
      }));

    const formattedReplies = recentRepliesEvents
      .filter((r) => r.prospect != null)
      .map((r) => ({
        id: r.id,
        eventType: r.reply_type === "REAL_REPLY" ? "REPLIED" : "REPLY_CLASSIFIED",
        occurredAt: r.classified_at.toISOString(),
        prospectName: r.prospect.name,
        company: r.prospect.company,
        details: r.reply_type,
      }));

    const formattedAudits = recentAudits.map((a) => ({
      id: a.id,
      eventType: "AUDIT",
      occurredAt: a.created_at.toISOString(),
      prospectName: a.action,
      company: "System",
      details: "",
    }));

    const allEvents = [...formattedEmailEvents, ...formattedReplies, ...formattedAudits]
      .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());

    // Deduplicate by eventType + prospectName so we don't spam the UI with 5 "Sent email to John"
    const uniqueEvents = [];
    const seen = new Set();
    for (const evt of allEvents) {
      const key = `${evt.eventType}-${evt.prospectName}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueEvents.push(evt);
      }
    }
    const formattedEvents = uniqueEvents.slice(0, 10);

    // Real-time scheduler status derived from health data
    const schedulerStatus =
      schedulerHealth.staleProcessingCount && schedulerHealth.staleProcessingCount > 0
        ? "STALE_STEPS"
        : schedulerHealth.processingCount && schedulerHealth.processingCount > 0
        ? "PROCESSING"
        : schedulerHealth.pendingDueCount && schedulerHealth.pendingDueCount > 0
        ? "PENDING_DUE"
        : "IDLE";

    const emailsSentToday = sequenceEmailsSentToday + adhocEmailsSentToday;

    return NextResponse.json({
      activeSequences,
      emailsSentToday,
      repliesToday,
      pendingReviews,
      failedSteps,
      stoppedSequences,
      recentEvents: formattedEvents,
      schedulerStatus,
      schedulerHealth,
      connectedGmail: emailAccount?.email || null,
      connectionStatus: emailAccount?.connection_status || "DISCONNECTED",
      gmailConfigured: !!(
        process.env.GMAIL_CLIENT_ID &&
        process.env.GMAIL_CLIENT_SECRET &&
        process.env.GMAIL_REFRESH_TOKEN &&
        process.env.GMAIL_SENDER_EMAIL
      ),
      geminiConfigured: !!process.env.GEMINI_API_KEY,
      systemTimestamp: new Date().toISOString(),
      dailyLimit: dailyLimitConfig?.value ? parseInt(String(dailyLimitConfig.value), 10) : 500,
      hourlyLimit: hourlyLimitConfig?.value ? parseInt(String(hourlyLimitConfig.value), 10) : 50,
      sequenceLimit: sequenceLimitConfig?.value ? parseInt(String(sequenceLimitConfig.value), 10) : 5,
      emailsSentThisHour: emailsSentThisHour ?? 0,
      bannerTheme: bannerThemeConfig?.value ? String(bannerThemeConfig.value) : "DEFAULT",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to load dashboard metrics";
    return NextResponse.json(
      { error: "Failed to load dashboard stats.", detail: msg },
      { status: 500 }
    );
  }
}

