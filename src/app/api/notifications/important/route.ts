import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    // 1. Fetch recent important replies (REAL_REPLY, PENDING review)
    const replies = await prisma.replyClassification.findMany({
      where: {
        reply_type: "REAL_REPLY",
        review_status: "PENDING",
      },
      include: {
        prospect: {
          select: { email: true, name: true }
        }
      },
      orderBy: { classified_at: "desc" },
      take: 5,
    });

    // 2. Format them into a unified notification structure
    const replyNotifications = replies.map(reply => ({
      id: reply.id,
      type: "reply",
      title: "New Reply Detected",
      message: `${reply.prospect?.name || reply.prospect?.email} has replied.`,
      timestamp: reply.classified_at.toISOString(),
      isRead: false,
      link: "/replies"
    }));

    // 3. Generate Daily Summary Notification
    const todaysRepliesCount = await prisma.replyClassification.count({
      where: {
        reply_type: "REAL_REPLY",
        classified_at: { gte: startOfToday }
      }
    });

    const latestReplyToday = await prisma.replyClassification.findFirst({
      where: {
        reply_type: "REAL_REPLY",
        classified_at: { gte: startOfToday }
      },
      orderBy: { classified_at: 'desc' }
    });

    let summaryMessage = "";
    if (todaysRepliesCount === 0) {
      summaryMessage = "No replies received yet today. Keep warming up!";
    } else {
      summaryMessage = `Great news! You successfully received ${todaysRepliesCount} replies today.`;
    }

    // Tie the summary timestamp to the latest reply today, or midnight if none
    const summaryTimestamp = latestReplyToday 
      ? latestReplyToday.classified_at.toISOString() 
      : startOfToday.toISOString();

    const summaryNotification = {
      id: `summary-${startOfToday.toISOString().split("T")[0]}`,
      type: "info",
      title: "Daily Reply Summary",
      message: summaryMessage,
      timestamp: summaryTimestamp,
      isRead: false,
      link: "/replies"
    };

    // Combine and sort
    const notifications = [summaryNotification, ...replyNotifications]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return NextResponse.json({ notifications: notifications.slice(0, 10) });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 });
  }
}
