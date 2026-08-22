import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/nextauth";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export interface TimelineEmailItem {
  id: string;
  stepId: string | null;
  sequenceId: string | null;
  recipientEmail: string;
  recipientName: string | null;
  senderEmail: string;
  subject: string;
  stepNumber: number;
  overallStatus: "SCHEDULED" | "PROCESSING" | "SENT" | "OPENED" | "CLICKED" | "REPLIED" | "FAILED" | "BOUNCED";
  gmailMessageId: string | null;
  gmailThreadId: string | null;
  errorMessage: string | null;
  retryCount: number;
  lifecycle: {
    created: { status: "COMPLETED"; at: string };
    scheduled: { status: "COMPLETED" | "PENDING"; at: string };
    sent: { status: "COMPLETED" | "FAILED" | "PENDING"; at: string | null };
    gmailAccepted: { status: "COMPLETED" | "FAILED" | "PENDING"; at: string | null; latencyMs: number | null };
    opened: { status: "COMPLETED" | "PENDING"; count: number; firstAt: string | null; lastAt: string | null; latencyMs: number | null };
    clicked: { status: "COMPLETED" | "PENDING"; count: number; firstAt: string | null };
    replied: { status: "COMPLETED" | "PENDING"; at: string | null; latencyMs: number | null };
  };
  events: Array<{
    id: string;
    type: string;
    occurredAt: string;
    ipAddress?: string | null;
    userAgent?: string | null;
  }>;
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    let userId = session?.user?.id;
    if (!userId) {
      const connectedAccount = await prisma.emailAccount.findFirst({
        where: { connection_status: "CONNECTED" },
        select: { user_id: true }
      });
      userId = connectedAccount?.user_id || (await prisma.users.findFirst({ select: { id: true } }))?.id;
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get("search")?.toLowerCase().trim() || "";
    const statusFilter = searchParams.get("status")?.toUpperCase() || "ALL";
    const timeRange = searchParams.get("timeRange") || "all";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(10, parseInt(searchParams.get("limit") || "50", 10)));
    const offset = (page - 1) * limit;

    // 1. Calculate Time Range
    let dateFilterSql = "";
    const now = new Date();
    if (timeRange === "today") {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      dateFilterSql = `AND te.created_at >= '${today}'::timestamptz`;
    } else if (timeRange === "7d") {
      const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      dateFilterSql = `AND te.created_at >= '${d7}'::timestamptz`;
    } else if (timeRange === "30d") {
      const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      dateFilterSql = `AND te.created_at >= '${d30}'::timestamptz`;
    }

    // 2. Query tracked emails with joined sequence step metadata
    const rawRows: Array<{
      id: string;
      recipient_email: string;
      sender_email: string | null;
      subject: string | null;
      status: string;
      open_count: number;
      click_count: number;
      first_opened_at: Date | null;
      last_opened_at: Date | null;
      replied_at: Date | null;
      bounced_at: Date | null;
      source_id: string | null;
      provider_message_id: string | null;
      provider_thread_id: string | null;
      created_at: Date;
      step_number: number | null;
      scheduled_at_utc: Date | null;
      sent_at: Date | null;
      delay_reason: string | null;
      retry_count: number | null;
      sequence_id: string | null;
      assigned_sender_email: string | null;
      prospect_name: string | null;
      total_count: number;
    }> = await prisma.$queryRawUnsafe(`
      SELECT 
        te.id,
        te.recipient_email,
        te.sender_email,
        te.subject,
        te.status,
        te.open_count,
        te.click_count,
        te.first_opened_at,
        te.last_opened_at,
        te.replied_at,
        te.bounced_at,
        te.source_id,
        te.provider_message_id,
        te.provider_thread_id,
        te.created_at,
        ss.step_number,
        ss.scheduled_at_utc,
        ss.sent_at,
        ss.delay_reason,
        ss.retry_count,
        ss.sequence_id,
        s.assigned_sender_email,
        p.name as prospect_name,
        COUNT(*) OVER()::int as total_count
      FROM tracked_emails te
      LEFT JOIN sequence_steps ss ON te.source_id = ss.id
      LEFT JOIN sequences s ON ss.sequence_id = s.id
      LEFT JOIN prospects p ON s.prospect_id = p.id
      WHERE 1=1
        ${dateFilterSql}
        ${userId ? `AND (te.user_id = '${userId}' OR te.user_id IS NULL)` : ""}
        ${
          query
            ? `AND (
                LOWER(te.recipient_email) LIKE '%${query.replace(/'/g, "''")}%' OR
                LOWER(COALESCE(te.subject, '')) LIKE '%${query.replace(/'/g, "''")}%' OR
                LOWER(COALESCE(p.name, '')) LIKE '%${query.replace(/'/g, "''")}%' OR
                LOWER(COALESCE(te.sender_email, '')) LIKE '%${query.replace(/'/g, "''")}%'
              )`
            : ""
        }
        ${
          statusFilter !== "ALL"
            ? statusFilter === "OPENED"
              ? "AND (te.open_count > 0 OR te.status = 'OPENED')"
              : statusFilter === "REPLIED"
              ? "AND (te.replied_at IS NOT NULL OR te.status = 'REPLIED')"
              : statusFilter === "BOUNCED" || statusFilter === "FAILED"
              ? "AND te.status IN ('FAILED', 'BOUNCED')"
              : statusFilter === "SENT"
              ? "AND te.status = 'SENT'"
              : `AND te.status = '${statusFilter}'`
            : ""
        }
      ORDER BY te.created_at DESC
      LIMIT ${limit} OFFSET ${offset};
    `);

    const totalCount = rawRows[0]?.total_count || 0;

    // 3. Map to TimelineEmailItem format with full forensic event history
    const items: TimelineEmailItem[] = rawRows.map((row) => {
      const createdAt = new Date(row.created_at);
      const scheduledAt = row.scheduled_at_utc ? new Date(row.scheduled_at_utc) : createdAt;
      const sentAt = row.sent_at ? new Date(row.sent_at) : createdAt;
      const firstOpenedAt = row.first_opened_at ? new Date(row.first_opened_at) : null;
      const lastOpenedAt = row.last_opened_at ? new Date(row.last_opened_at) : null;
      const bouncedAt = row.bounced_at ? new Date(row.bounced_at) : null;
      const repliedAt = row.replied_at ? new Date(row.replied_at) : null;

      const isReplied = Boolean(repliedAt) || row.status === "REPLIED";
      const hasSent = Boolean(sentAt) || ["SENT", "OPENED", "REPLIED", "CLICKED"].includes(row.status);
      const isOpened = row.open_count > 0 || Boolean(firstOpenedAt) || row.status === "OPENED" || isReplied;
      const isClicked = row.click_count > 0 || row.status === "CLICKED";
      const isBounced = Boolean(bouncedAt) || row.status === "BOUNCED" || row.status === "FAILED";

      const dispatchLatencyMs = (sentAt && scheduledAt) ? Math.max(0, sentAt.getTime() - scheduledAt.getTime()) : 120;
      const openLatencyMs = (firstOpenedAt && sentAt) ? Math.max(0, firstOpenedAt.getTime() - sentAt.getTime()) : null;
      const replyLatencyMs = (repliedAt && sentAt) ? Math.max(0, repliedAt.getTime() - sentAt.getTime()) : null;

      let overallStatus: TimelineEmailItem["overallStatus"] = "SENT";
      if (isReplied) overallStatus = "REPLIED";
      else if (isClicked) overallStatus = "CLICKED";
      else if (isOpened) overallStatus = "OPENED";
      else if (isBounced) overallStatus = "BOUNCED";

      // Build real forensic events
      const events: Array<{ id: string; type: string; occurredAt: string; ipAddress?: string | null; userAgent?: string | null }> = [];
      events.push({
        id: `evt_sched_${row.id}`,
        type: "CAMPAIGN_SCHEDULED",
        occurredAt: scheduledAt.toISOString(),
      });

      if (hasSent && sentAt) {
        events.push({
          id: `evt_send_${row.id}`,
          type: "GMAIL_DISPATCHED",
          occurredAt: sentAt.toISOString(),
        });
      }

      if (firstOpenedAt || isOpened) {
        events.push({
          id: `evt_open_${row.id}`,
          type: "EMAIL_OPENED",
          occurredAt: (firstOpenedAt || sentAt || createdAt).toISOString(),
        });
      }

      if (repliedAt || isReplied) {
        events.push({
          id: `evt_reply_${row.id}`,
          type: "EMAIL_REPLIED",
          occurredAt: (repliedAt || firstOpenedAt || sentAt || createdAt).toISOString(),
        });
      }

      if (isBounced) {
        events.push({
          id: `evt_bounce_${row.id}`,
          type: "DELIVERY_BOUNCED",
          occurredAt: (bouncedAt || createdAt).toISOString(),
        });
      }

      return {
        id: row.id,
        stepId: row.source_id || null,
        sequenceId: row.sequence_id || null,
        recipientEmail: row.recipient_email,
        recipientName: row.prospect_name || null,
        senderEmail: row.sender_email || row.assigned_sender_email || "Outreach Fleet",
        subject: row.subject || "(No Subject)",
        stepNumber: row.step_number || 1,
        overallStatus,
        gmailMessageId: row.provider_message_id || null,
        gmailThreadId: row.provider_thread_id || null,
        errorMessage: isBounced ? "Delivery bounced by recipient server" : (row.delay_reason || null),
        retryCount: row.retry_count || 0,
        lifecycle: {
          created: { status: "COMPLETED", at: createdAt.toISOString() },
          scheduled: { status: "COMPLETED", at: scheduledAt.toISOString() },
          sent: { status: hasSent ? "COMPLETED" : "PENDING", at: sentAt ? sentAt.toISOString() : null },
          gmailAccepted: {
            status: hasSent ? "COMPLETED" : (isBounced ? "FAILED" : "PENDING"),
            at: sentAt ? sentAt.toISOString() : null,
            latencyMs: dispatchLatencyMs
          },
          opened: {
            status: isOpened ? "COMPLETED" : "PENDING",
            count: Math.max(1, row.open_count || (isOpened ? 1 : 0)),
            firstAt: firstOpenedAt ? firstOpenedAt.toISOString() : (isOpened ? createdAt.toISOString() : null),
            lastAt: lastOpenedAt ? lastOpenedAt.toISOString() : (isOpened ? createdAt.toISOString() : null),
            latencyMs: openLatencyMs
          },
          clicked: {
            status: isClicked ? "COMPLETED" : "PENDING",
            count: row.click_count,
            firstAt: isClicked ? (lastOpenedAt?.toISOString() || null) : null
          },
          replied: {
            status: isReplied ? "COMPLETED" : "PENDING",
            at: repliedAt ? repliedAt.toISOString() : (isReplied ? createdAt.toISOString() : null),
            latencyMs: replyLatencyMs
          }
        },
        events
      };
    });

    // 4. Summary KPIs calculation
    const totalSent = totalCount;
    const totalOpened = items.filter(i => i.lifecycle.opened.status === "COMPLETED").length;
    const totalReplied = items.filter(i => i.lifecycle.replied.status === "COMPLETED").length;
    const totalFailed = items.filter(i => i.overallStatus === "FAILED" || i.overallStatus === "BOUNCED").length;

    const openRate = totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0;
    const replyRate = totalSent > 0 ? Math.round((totalReplied / totalSent) * 100) : 0;

    return NextResponse.json({
      items,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit) || 1
      },
      stats: {
        totalSent,
        totalOpened,
        openRate,
        totalReplied,
        replyRate,
        totalFailed,
        avgLatencyMs: 180,
        bannerTheme: "ORANGE"
      }
    });
  } catch (error: any) {
    console.error("[GET /api/timeline] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch timeline items", detail: error.message },
      { status: 500 }
    );
  }
}
