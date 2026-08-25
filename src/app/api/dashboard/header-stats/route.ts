import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { telemetryCache } from "@/lib/cache/telemetry-cache";
import { getDailyTelemetryStats } from "@/lib/telemetry/daily-stats";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Read browser's exact timezone header if provided
    const clientTimezone = req.headers.get("x-timezone") || req.nextUrl.searchParams.get("tz");

    // Fast-path in-memory cache hit (0.1ms)
    const cachedData = telemetryCache.getHeaderStats(userId);
    if (cachedData && cachedData.inboxCount > 0) {
      return NextResponse.json(cachedData);
    }

    // Query connected accounts for inbox rotation header status
    let connectedAccounts = await prisma.emailAccount.findMany({
      where: {
        connection_status: "CONNECTED",
        user_id: userId,
      },
      orderBy: { updated_at: "desc" },
      select: { email: true, connection_status: true },
    });

    if (connectedAccounts.length === 0) {
      connectedAccounts = await prisma.emailAccount.findMany({
        where: { connection_status: "CONNECTED" },
        orderBy: { updated_at: "desc" },
        select: { email: true, connection_status: true },
      });
    }

    const inboxCount = connectedAccounts.length;
    let connectedGmail: string | null = null;

    if (inboxCount === 1) {
      connectedGmail = connectedAccounts[0].email;
    } else if (inboxCount > 1) {
      connectedGmail = `${inboxCount} Inboxes Rotating`;
    }

    // Compute exact daily counts via unified telemetry resolver
    const dailyStats = await getDailyTelemetryStats(userId, clientTimezone);

    const payload = {
      connectedGmail,
      inboxCount,
      accounts: connectedAccounts.map((a) => a.email),
      connectionStatus: inboxCount > 0 ? "CONNECTED" : "DISCONNECTED",
      emailsSentToday: dailyStats.emailsSentToday,
      repliesToday: dailyStats.repliesToday,
      timezone: dailyStats.timezone,
      dateKey: dailyStats.dateKey,
    };

    telemetryCache.setHeaderStats(userId, payload, dailyStats.dateKey);

    return NextResponse.json(payload);
  } catch (error: any) {
    console.error("[header-stats] Error:", error);
    return NextResponse.json({ error: "Failed to fetch header stats" }, { status: 500 });
  }
}
