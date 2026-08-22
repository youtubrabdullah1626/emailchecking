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

    const [counts] = await prisma.$queryRaw<Array<{ sent_today: number; replies_today: number }>>`
      SELECT 
        (SELECT count(*)::int FROM sequence_steps ss JOIN sequences s ON ss.sequence_id = s.id WHERE ss.status = 'SENT' AND ss.sent_at >= CURRENT_DATE AND s.user_id = ${userId}) as sent_today,
        (SELECT count(*)::int FROM reply_classifications rc JOIN sequences s ON rc.sequence_id = s.id WHERE rc.reply_type = 'REAL_REPLY' AND rc.classified_at >= CURRENT_DATE AND s.user_id = ${userId}) as replies_today;
    `.catch(() => [{ sent_today: 0, replies_today: 0 }]);

    return NextResponse.json({
      connectedGmail,
      inboxCount,
      accounts: connectedAccounts.map(a => a.email),
      connectionStatus: inboxCount > 0 ? "CONNECTED" : "DISCONNECTED",
      emailsSentToday: counts?.sent_today || 0,
      repliesToday: counts?.replies_today || 0,
    });

  } catch (error: any) {
    console.error("[header-stats] Error:", error);
    return NextResponse.json({ error: "Failed to fetch header stats" }, { status: 500 });
  }
}
