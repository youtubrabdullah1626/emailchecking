export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";

export async function GET() {
  try {
    const session = await getSession();
    let userId = session?.user?.id;
    if (!userId) {
      const connectedAccount = await prisma.emailAccount.findFirst({
        where: { connection_status: "CONNECTED", refresh_token: { not: null } },
        select: { user_id: true }
      });
      userId = connectedAccount?.user_id || (await prisma.users.findFirst({ select: { id: true } }))?.id;
    }

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Query all connected email accounts for this user
    const connectedAccounts = await prisma.emailAccount.findMany({
      where: {
        connection_status: "CONNECTED",
        user_id: userId
      },
      orderBy: { updated_at: "desc" },
      select: { email: true, connection_status: true }
    });

    const inboxCount = connectedAccounts.length;
    let connectedGmail: string | null = null;

    if (inboxCount === 1) {
      connectedGmail = connectedAccounts[0].email;
    } else if (inboxCount > 1) {
      connectedGmail = `${inboxCount} Inboxes Rotating`;
    }

    const userRecord = await prisma.users.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });
    const userTimezone = userRecord?.timezone || "UTC";
    const { getStartOfDayInTimezone } = await import("@/lib/date-utils");
    const startOfDay = getStartOfDayInTimezone(userTimezone);

    const [sentToday, repliesToday] = await Promise.all([
      prisma.sequenceStep.count({
        where: {
          status: "SENT",
          sent_at: { gte: startOfDay },
          sequence: { user_id: userId }
        }
      }).catch(() => 0),
      prisma.replyClassification.count({
        where: {
          reply_type: "REAL_REPLY",
          classified_at: { gte: startOfDay },
          prospect: { user_id: userId }
        }
      }).catch(() => 0)
    ]);

    return NextResponse.json({
      connectedGmail,
      inboxCount,
      accounts: connectedAccounts.map(a => a.email),
      connectionStatus: inboxCount > 0 ? "CONNECTED" : "DISCONNECTED",
      emailsSentToday: sentToday,
      repliesToday: repliesToday,
    });

  } catch (error: any) {
    console.error("[header-stats] Error:", error);
    return NextResponse.json({ error: "Failed to fetch header stats" }, { status: 500 });
  }
}
