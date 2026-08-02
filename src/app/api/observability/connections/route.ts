import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const accounts = await prisma.emailAccount.findMany({
      orderBy: { created_at: "desc" },
    });
    
    const watches = await prisma.gmailWatchState.findMany();
    
    // Merge data
    const connections = accounts.map((acc) => {
      const watch = watches.find(w => w.email === acc.email);
      let derivedStatus = acc.connection_status;
      
      if (acc.connection_status === "CONNECTED") {
        if (watch?.health_status === "EXPIRING_SOON") derivedStatus = "WATCH_EXPIRING";
        else if (watch?.health_status === "EXPIRED") derivedStatus = "WATCH_EXPIRED";
        else if (watch?.health_status === "NEEDS_RECONNECT") derivedStatus = "NEEDS_RECONNECT";
      }

      return {
        email: acc.email,
        status: derivedStatus,
        tokenExpiresAt: acc.token_expires_at,
        dailyLimit: acc.daily_limit,
        sentToday: acc.sent_today,
        healthScore: acc.health_score,
        watch: watch ? {
          status: watch.health_status,
          expiration: Number(watch.expiration),
          lastSyncedAt: watch.last_synced_at,
          errorCount: watch.error_count,
        } : null
      };
    });

    return NextResponse.json({ connections });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to retrieve connection statuses" },
      { status: 500 }
    );
  }
}
