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
    const userId = session?.user?.id;

    const { searchParams } = new URL(req.url);
    const query = searchParams.get("search")?.toLowerCase().trim() || "";
    const statusFilter = searchParams.get("status")?.toUpperCase() || "ALL";
    const timeRange = searchParams.get("timeRange") || "all";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(10, parseInt(searchParams.get("limit") || "50", 10)));

    // 1. Calculate Time Range Filter
    let dateFilter: Date | undefined;
    const now = new Date();
    if (timeRange === "today") {
      dateFilter = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (timeRange === "7d") {
      dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (timeRange === "30d") {
      dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // 2. Query Tracked Emails
    const trackedWhere: any = {};
    if (dateFilter) {
      trackedWhere.created_at = { gte: dateFilter };
    }
    if (userId) {
      trackedWhere.OR = [
        { user_id: userId },
        { user_id: null }
      ];
    }

    const trackedEmails = await prisma.trackedEmail.findMany({
      where: trackedWhere,
      orderBy: { created_at: "desc" },
      take: 250,
      include: {
        events: {
          orderBy: { occurred_at: "asc" }
        }
      }
    });

    // Extract step IDs to fetch associated sequence context
    const stepIds = trackedEmails
      .map((t) => t.source_id)
      .filter((id): id is string => Boolean(id));

    const sequenceSteps = stepIds.length > 0
      ? await prisma.sequenceStep.findMany({
          where: { id: { in: stepIds } },
          include: {
            sequence: {
              include: {
                prospect: true,
              }
            },
            email_events: {
              orderBy: { occurred_at: "asc" }
            }
          }
        })
      : [];

    const stepMap = new Map<string, any>(sequenceSteps.map((s) => [s.id, s]));

    // 3. Build Normalized Timeline Email Items
    const items: TimelineEmailItem[] = trackedEmails.map((tracked) => {
      const step = tracked.source_id ? stepMap.get(tracked.source_id) : undefined;
      const prospect = step?.sequence?.prospect;

      const createdAt = tracked.created_at;
      const scheduledAt = step?.scheduled_at_utc || createdAt;
      const sentAt = step?.sent_at || createdAt;
      const firstOpenedAt = tracked.first_opened_at;
      const lastOpenedAt = tracked.last_opened_at;
      const repliedAt = tracked.replied_at;
      const bouncedAt = tracked.bounced_at;

      const hasSent = Boolean(sentAt);
      const isOpened = tracked.open_count > 0 || Boolean(firstOpenedAt) || tracked.status === "OPENED";
      const isReplied = Boolean(repliedAt) || tracked.status === "REPLIED";
      const isClicked = tracked.click_count > 0 || tracked.status === "CLICKED";
      const isBounced = Boolean(bouncedAt) || tracked.status === "BOUNCED";

      // Latency computations
      const dispatchLatencyMs = (sentAt && scheduledAt) ? Math.max(0, sentAt.getTime() - scheduledAt.getTime()) : null;
      const openLatencyMs = (firstOpenedAt && sentAt) ? Math.max(0, firstOpenedAt.getTime() - sentAt.getTime()) : null;
      const replyLatencyMs = (repliedAt && sentAt) ? Math.max(0, repliedAt.getTime() - sentAt.getTime()) : null;

      let overallStatus: TimelineEmailItem["overallStatus"] = "SENT";
      if (isReplied) overallStatus = "REPLIED";
      else if (isClicked) overallStatus = "CLICKED";
      else if (isOpened) overallStatus = "OPENED";
      else if (isBounced) overallStatus = "BOUNCED";
      else if (step?.status === "PENDING") overallStatus = "SCHEDULED";
      else if (step?.status === "PROCESSING") overallStatus = "PROCESSING";
      else if (step?.status === "FAILED") overallStatus = "FAILED";

      const recipientName = prospect 
        ? `${prospect.first_name || ""} ${prospect.last_name || ""}`.trim() || null
        : null;

      return {
        id: tracked.id,
        stepId: step?.id || tracked.source_id || null,
        sequenceId: step?.sequence_id || null,
        recipientEmail: tracked.recipient_email,
        recipientName,
        senderEmail: tracked.sender_email || step?.sequence?.assigned_sender_email || "Outreach Fleet",
        subject: tracked.subject || step?.subject || "(No Subject)",
        stepNumber: step?.step_number || 1,
        overallStatus,
        gmailMessageId: tracked.provider_message_id || step?.gmail_message_id || null,
        gmailThreadId: tracked.provider_thread_id || step?.gmail_thread_id || null,
        errorMessage: isBounced ? "Delivery bounced by recipient server" : (step?.delay_reason || null),
        retryCount: step?.retry_count || 0,
        lifecycle: {
          created: {
            status: "COMPLETED",
            at: createdAt.toISOString()
          },
          scheduled: {
            status: "COMPLETED",
            at: scheduledAt.toISOString()
          },
          sent: {
            status: hasSent ? "COMPLETED" : "PENDING",
            at: sentAt ? sentAt.toISOString() : null
          },
          gmailAccepted: {
            status: hasSent ? "COMPLETED" : (isBounced ? "FAILED" : "PENDING"),
            at: sentAt ? sentAt.toISOString() : null,
            latencyMs: dispatchLatencyMs
          },
          opened: {
            status: isOpened ? "COMPLETED" : "PENDING",
            count: tracked.open_count,
            firstAt: firstOpenedAt ? firstOpenedAt.toISOString() : null,
            lastAt: lastOpenedAt ? lastOpenedAt.toISOString() : null,
            latencyMs: openLatencyMs
          },
          clicked: {
            status: isClicked ? "COMPLETED" : "PENDING",
            count: tracked.click_count,
            firstAt: isClicked ? (lastOpenedAt?.toISOString() || null) : null
          },
          replied: {
            status: isReplied ? "COMPLETED" : "PENDING",
            at: repliedAt ? repliedAt.toISOString() : null,
            latencyMs: replyLatencyMs
          }
        },
        events: tracked.events.map((e) => ({
          id: e.id,
          type: e.event_type,
          occurredAt: e.occurred_at.toISOString(),
          ipAddress: e.ip_address,
          userAgent: e.user_agent,
        }))
      };
    });

    // 4. Client-side Search & Status Filtering
    let filteredItems = items;
    if (query) {
      filteredItems = filteredItems.filter(item => 
        item.recipientEmail.toLowerCase().includes(query) ||
        (item.recipientName && item.recipientName.toLowerCase().includes(query)) ||
        item.senderEmail.toLowerCase().includes(query) ||
        item.subject.toLowerCase().includes(query) ||
        (item.gmailMessageId && item.gmailMessageId.toLowerCase().includes(query))
      );
    }

    if (statusFilter !== "ALL") {
      filteredItems = filteredItems.filter(item => {
        if (statusFilter === "OPENED") return item.lifecycle.opened.status === "COMPLETED";
        if (statusFilter === "REPLIED") return item.lifecycle.replied.status === "COMPLETED";
        if (statusFilter === "SENT") return item.lifecycle.sent.status === "COMPLETED";
        if (statusFilter === "FAILED" || statusFilter === "BOUNCED") return item.overallStatus === "FAILED" || item.overallStatus === "BOUNCED";
        if (statusFilter === "SCHEDULED") return item.overallStatus === "SCHEDULED";
        return item.overallStatus === statusFilter;
      });
    }

    // 5. Aggregate Summary KPIs
    const totalSent = items.filter(i => i.lifecycle.sent.status === "COMPLETED").length;
    const totalOpened = items.filter(i => i.lifecycle.opened.status === "COMPLETED").length;
    const totalReplied = items.filter(i => i.lifecycle.replied.status === "COMPLETED").length;
    const totalFailed = items.filter(i => i.overallStatus === "FAILED" || i.overallStatus === "BOUNCED").length;

    const latencies = items
      .map(i => i.lifecycle.gmailAccepted.latencyMs)
      .filter((l): l is number => l !== null && l > 0 && l < 60000);
    const avgLatencyMs = latencies.length > 0
      ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
      : 180;

    const openRate = totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0;
    const replyRate = totalSent > 0 ? Math.round((totalReplied / totalSent) * 100) : 0;

    // Pagination
    const totalCount = filteredItems.length;
    const paginatedItems = filteredItems.slice((page - 1) * limit, page * limit);

    return NextResponse.json({
      items: paginatedItems,
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
        avgLatencyMs
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
