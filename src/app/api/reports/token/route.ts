import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/nextauth";
import { generateReportToken } from "@/lib/reports/token";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const campaignId = searchParams.get("campaignId");

    if (!campaignId) {
      return NextResponse.json({ error: "Missing campaignId parameter" }, { status: 400 });
    }

    // Verify ownership or admin
    const campaign = await prisma.campaign.findFirst({
      where: (campaignId === "latest" || campaignId === "active")
        ? { user_id: userId }
        : { id: campaignId, user_id: userId },
      select: { id: true, name: true },
      orderBy: { updated_at: "desc" },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const token = generateReportToken(campaign.id);
    const forwardedHost = req.headers.get("x-forwarded-host") || req.headers.get("host") || "reachiq.up.railway.app";
    const forwardedProto = req.headers.get("x-forwarded-proto") || "https";
    const cleanHost = forwardedHost.startsWith("localhost") || forwardedHost.startsWith("127.0.0.1")
      ? forwardedHost
      : forwardedHost.split(":")[0];
    const origin = `${forwardedProto}://${cleanHost}`;
    const reportUrl = `${origin}/report/${token}`;

    return NextResponse.json({
      success: true,
      campaignId: campaign.id,
      campaignName: campaign.name,
      token,
      reportUrl,
    });
  } catch (error) {
    console.error("[GET /api/reports/token] Error:", error);
    return NextResponse.json({ error: "Failed to generate report token" }, { status: 500 });
  }
}
