import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // user_id in WHERE prevents IDOR — user can only read their own campaigns
    const campaign = await prisma.campaign.findUnique({
      where: { id: params.id, user_id: session.user.id },
      include: {
        prospects: {
          include: {
            sequences: {
              orderBy: { created_at: "desc" },
              take: 1,
              include: {
                steps: { orderBy: { step_number: "asc" } }
              }
            }
          },
          orderBy: { created_at: "desc" }
        }
      }
    });

    if (!campaign) {
      return NextResponse.json({ ok: false, error: "Campaign not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, data: campaign });
  } catch (error: any) {
    console.error("Failed to fetch campaign details", error);
    return NextResponse.json({ ok: false, error: "Failed to load campaign" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action, campaignName } = body;
    const { pauseCampaign, activateCampaign } = await import("@/lib/campaign/lifecycle");

    // ── Robust Campaign Resolver ──────────────────────────────────────────────
    let campaign = await prisma.campaign.findFirst({
      where: {
        OR: [
          { id: params.id, user_id: session.user.id },
          { name: params.id, user_id: session.user.id },
        ]
      },
      select: { id: true, status: true }
    });

    if (!campaign) {
      const job = await prisma.importJob.findFirst({
        where: { id: params.id, userId: session.user.id },
        select: { campaignId: true }
      });
      if (job?.campaignId) {
        campaign = await prisma.campaign.findFirst({
          where: { id: job.campaignId, user_id: session.user.id },
          select: { id: true, status: true }
        });
      }
    }

    if (!campaign && campaignName) {
      campaign = await prisma.campaign.findFirst({
        where: { name: campaignName, user_id: session.user.id },
        select: { id: true, status: true },
        orderBy: { created_at: "desc" }
      });
    }

    if (!campaign) {
      return NextResponse.json({ ok: false, error: "Campaign not found." }, { status: 404 });
    }

    const resolvedCampaignId = campaign.id;

    if (action === "PAUSE") {
      const result = await pauseCampaign(resolvedCampaignId, session.user.id);
      if (!result.success) {
        return NextResponse.json({ ok: false, error: result.message || "Failed to pause campaign" }, { status: 400 });
      }
      return NextResponse.json({ ok: true, message: "Campaign paused successfully" });
    }

    if (action === "RESUME" || action === "ACTIVATE") {
      const result = await activateCampaign(resolvedCampaignId, session.user.id);
      if (!result.success) {
        return NextResponse.json({ ok: false, error: result.message || "Failed to activate campaign" }, { status: 400 });
      }
      return NextResponse.json({ ok: true, message: "Campaign activated successfully", activeCount: result.activeCount });
    }

    return NextResponse.json({ ok: false, error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("Failed to update campaign lifecycle status", error);
    return NextResponse.json({ ok: false, error: error.message || "Failed to update campaign" }, { status: 500 });
  }
}
