import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { errorTracker } from "@/lib/observability/errors";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { email: string } }
) {
  try {
    const email = decodeURIComponent(params.email);

    const account = await prisma.emailAccount.findUnique({
      where: { email },
      select: {
        email: true,
        connection_status: true,
        daily_limit: true,
        hourly_limit: true,
        sent_today: true,
        sent_this_hour: true,
        health_score: true,
        warmup_status: true,
        created_at: true,
      }
    });

    if (!account) {
      return NextResponse.json({ error: "User account not found." }, { status: 404 });
    }

    // Fetch real recent activity log
    const recentActivity = await prisma.emailEvent.findMany({
      take: 10,
      orderBy: { occurred_at: 'desc' },
      include: {
        step: {
          include: {
            sequence: {
              include: {
                prospect: { select: { email: true, name: true } }
              }
            }
          }
        }
      }
    });

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const startOfThisHour = new Date();
    startOfThisHour.setMinutes(0, 0, 0);

    const [realSentToday, realSentThisHour] = await Promise.all([
      prisma.emailEvent.count({
        where: {
          event_type: 'SENT',
          occurred_at: { gte: startOfToday }
        }
      }),
      prisma.emailEvent.count({
        where: {
          event_type: 'SENT',
          occurred_at: { gte: startOfThisHour }
        }
      })
    ]);

    const honestAccount = {
      ...account,
      sent_today: realSentToday,
      sent_this_hour: realSentThisHour
    };

    return NextResponse.json({ data: honestAccount, activity: recentActivity });
  } catch (error) {
    await errorTracker.trackError({
      service: "AdminUserDetailAPI",
      category: "Database",
      severity: "HIGH",
      message: `Failed to fetch admin user detail: ${error instanceof Error ? error.message : String(error)}`,
      error
    });
    
    return NextResponse.json(
      { error: "Failed to load user account details securely." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { email: string } }
) {
  try {
    const email = decodeURIComponent(params.email);
    const body = await request.json();
    const { daily_limit, hourly_limit } = body;

    const updated = await prisma.emailAccount.update({
      where: { email },
      data: {
        daily_limit: Number(daily_limit),
        hourly_limit: Number(hourly_limit)
      }
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    await errorTracker.trackError({
      service: "AdminUserDetailAPI",
      category: "Database",
      severity: "HIGH",
      message: `Failed to update admin user limits: ${error instanceof Error ? error.message : String(error)}`,
      error
    });
    return NextResponse.json({ error: "Failed to update limits" }, { status: 500 });
  }
}
