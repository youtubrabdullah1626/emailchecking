export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";

export async function GET() {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);

    // Run only the 4 lightning-fast queries needed for the global Header
    const [
      sequenceEmailsSentToday,
      adhocEmailsSentToday,
      repliesToday,
      emailAccount
    ] = await Promise.all([
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
      prisma.emailAccount.findFirst({
        where: { user_id: userId, is_primary: true }
      })
    ]);

    return NextResponse.json({
      emailsSentToday: sequenceEmailsSentToday + adhocEmailsSentToday,
      repliesToday,
      connectedGmail: emailAccount?.email_address || null,
      connectionStatus: emailAccount?.status || "DISCONNECTED"
    });

  } catch (error: any) {
    console.error("[header-stats] Error:", error);
    return NextResponse.json({ error: "Failed to fetch header stats" }, { status: 500 });
  }
}
