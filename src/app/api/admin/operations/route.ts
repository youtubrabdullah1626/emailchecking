import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSystemHealth } from "@/lib/health/system";
import { getDatabaseHealth } from "@/lib/health/database";
import { getGmailHealth } from "@/lib/health/gmail";
import { getSchedulerHealth } from "@/lib/health/scheduler";
import { getAIHealth } from "@/lib/health/ai";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [sys, db, gmail, scheduler, ai] = await Promise.all([
      getSystemHealth(),
      getDatabaseHealth(),
      getGmailHealth(),
      getSchedulerHealth(),
      getAIHealth(),
    ]);

    // Scheduler Performance
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);

    const [schedulerRunsToday, processed, successful, failed] = await Promise.all([
      prisma.emailEvent.count({ where: { occurred_at: { gte: startOfDay } } }), // Mock runs
      prisma.emailEvent.count({ where: { occurred_at: { gte: startOfDay }, event_type: { in: ["SENT", "FAILED"] } } }),
      prisma.emailEvent.count({ where: { occurred_at: { gte: startOfDay }, event_type: "SENT" } }),
      prisma.emailEvent.count({ where: { occurred_at: { gte: startOfDay }, event_type: "FAILED" } })
    ]);

    const schedulerSuccessRate = processed > 0 ? (successful / processed) * 100 : 100;
    
    // Gmail Sending Performance
    const sentToday = successful;
    const gmailSuccessRate = sentToday + failed > 0 ? (sentToday / (sentToday + failed)) * 100 : 100;

    return NextResponse.json({
      health: {
        application: sys.status,
        database: db.status,
        gmail: gmail.status,
        scheduler: "running", // mock
        ai: ai.status,
      },
      schedulerAnalytics: {
        runsToday: schedulerRunsToday > 0 ? Math.ceil(schedulerRunsToday / 15) : 0, // estimate runs if 1 run per batch
        processed,
        successful,
        failed,
        successRate: schedulerSuccessRate.toFixed(1) + "%",
        averageExecutionTime: scheduler.averageExecutionTime + " sec",
      },
      gmailAnalytics: {
        sentToday,
        successful,
        failed,
        successRate: gmailSuccessRate.toFixed(1) + "%",
        remainingCapacity: Math.max(0, gmail.dailyCapacity - sentToday),
      },
    });
  } catch (err) {
    return NextResponse.json({ error: "Failed to load operations data" }, { status: 500 });
  }
}
