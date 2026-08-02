import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const emailsSentTotal = await prisma.emailEvent.count({ where: { event_type: "SENT" } });
    const emailsSentToday = await prisma.emailEvent.count({ 
      where: { event_type: "SENT", occurred_at: { gte: today } } 
    });

    const repliesTotal = await prisma.replyClassification.count();
    const repliesToday = await prisma.replyClassification.count({
      where: { classified_at: { gte: today } }
    });
    
    const activeSequences = await prisma.sequence.count({ where: { status: "ACTIVE" } });
    
    // Recent system errors (last 24h)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentErrors = await prisma.systemError.aggregate({
      _sum: { count: true },
      where: { lastSeen: { gte: yesterday } }
    });

    return NextResponse.json({ 
      metrics: {
        emailsSentTotal,
        emailsSentToday,
        repliesTotal,
        repliesToday,
        replyRate: emailsSentTotal > 0 ? (repliesTotal / emailsSentTotal) * 100 : 0,
        activeSequences,
        systemErrors24h: recentErrors._sum.count || 0
      } 
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to retrieve metrics" },
      { status: 500 }
    );
  }
}
