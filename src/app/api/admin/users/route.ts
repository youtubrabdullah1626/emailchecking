import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { errorTracker } from "@/lib/observability/errors";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const users = await prisma.emailAccount.findMany({
      orderBy: { created_at: "desc" },
      select: {
        email: true,
        connection_status: true,
        daily_limit: true,
        hourly_limit: true,
        sent_today: true,
        health_score: true,
        warmup_status: true,
        created_at: true,
      }
    });

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const realSentToday = await prisma.emailEvent.count({
      where: {
        event_type: 'SENT',
        occurred_at: { gte: startOfToday }
      }
    });

    const honestUsers = users.map(u => ({
      ...u,
      sent_today: realSentToday
    }));

    return NextResponse.json({
      data: honestUsers
    });
  } catch (error) {
    await errorTracker.trackError({
      service: "AdminUsersAPI",
      category: "Database",
      severity: "HIGH",
      message: `Failed to fetch admin users: ${error instanceof Error ? error.message : String(error)}`,
      error
    });
    
    return NextResponse.json(
      { error: "Failed to load user accounts securely." },
      { status: 500 }
    );
  }
}
