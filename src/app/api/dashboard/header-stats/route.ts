export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getTenantPrisma } from "@/lib/db/tenant-prisma";
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

    const tenantPrisma = getTenantPrisma(session.user.id);
    
    // Query all connected email accounts for this user
    const connectedAccounts = await tenantPrisma.emailAccount.findMany({
      where: { connection_status: "CONNECTED" },
      orderBy: { updated_at: "desc" },
      select: { email: true }
    });

    const inboxCount = connectedAccounts.length;
    let connectedGmail: string | null = null;

    if (inboxCount === 1) {
      connectedGmail = connectedAccounts[0].email;
    } else if (inboxCount > 1) {
      connectedGmail = `${inboxCount} Inboxes Rotating`;
    }

    return NextResponse.json({
      connectedGmail,
      inboxCount,
      accounts: connectedAccounts.map(a => a.email),
      connectionStatus: inboxCount > 0 ? "CONNECTED" : "DISCONNECTED"
    });

  } catch (error: any) {
    console.error("[header-stats] Error:", error);
    return NextResponse.json({ error: "Failed to fetch header stats" }, { status: 500 });
  }
}
