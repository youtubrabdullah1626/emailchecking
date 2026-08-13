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
    
    // Run only the lightning-fast query needed for the global Header Account Status
    const emailAccount = await tenantPrisma.emailAccount.findFirst({
      orderBy: { updated_at: "desc" },
      select: { email: true, connection_status: true }
    });

    return NextResponse.json({
      connectedGmail: emailAccount?.email || null,
      connectionStatus: emailAccount?.connection_status || "DISCONNECTED"
    });

  } catch (error: any) {
    console.error("[header-stats] Error:", error);
    return NextResponse.json({ error: "Failed to fetch header stats" }, { status: 500 });
  }
}
