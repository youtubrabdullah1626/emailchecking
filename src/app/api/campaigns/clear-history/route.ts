import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
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

    const body = await req.json().catch(() => ({}));
    const timeframe = body.timeframe || "all"; // "24h" | "7d" | "30d" | "all"

    let cutoff: Date | null = null;
    const now = new Date();
    if (timeframe === "24h") {
      cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    } else if (timeframe === "7d") {
      cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (timeframe === "30d") {
      cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // 1. Identify campaigns to delete
    const campaignWhere: any = { user_id: userId };
    if (cutoff) {
      campaignWhere.created_at = { gte: cutoff };
    }
    const campaigns = await prisma.campaign.findMany({
      where: campaignWhere,
      select: { id: true }
    });
    const campaignIds = campaigns.map(c => c.id);

    // 2. Identify prospects
    const prospectWhere: any = { user_id: userId };
    if (cutoff) {
      prospectWhere.OR = [
        { campaign_id: { in: campaignIds } },
        { created_at: { gte: cutoff } }
      ];
    }
    const prospects = await prisma.prospect.findMany({
      where: prospectWhere,
      select: { id: true, email: true }
    });
    const prospectIds = prospects.map(p => p.id);
    const prospectEmails = prospects.map(p => p.email.toLowerCase());

    // 3. Identify sequences
    const sequenceWhere: any = {
      OR: [
        { user_id: userId },
        { prospect_id: { in: prospectIds } }
      ]
    };
    if (cutoff) {
      sequenceWhere.created_at = { gte: cutoff };
    }
    const sequences = await prisma.sequence.findMany({
      where: sequenceWhere,
      select: { id: true }
    });
    const sequenceIds = sequences.map(s => s.id);

    // 4. Identify steps
    const steps = await prisma.sequenceStep.findMany({
      where: { sequence_id: { in: sequenceIds } },
      select: { id: true }
    });
    const stepIds = steps.map(s => s.id);

    // 5. Cascade cleanup
    await prisma.$transaction(async (tx) => {
      // Clean tracked emails & tracking events
      if (stepIds.length > 0 || prospectEmails.length > 0) {
        await tx.trackedEmail.deleteMany({
          where: {
            OR: [
              ...(stepIds.length > 0 ? [{ source_id: { in: stepIds } }] : []),
              ...(prospectEmails.length > 0 ? [{ recipient_email: { in: prospectEmails, mode: "insensitive" as any } }] : []),
              ...(cutoff ? [{ created_at: { gte: cutoff }, user_id: userId }] : [{ user_id: userId }])
            ]
          }
        });
      }

      // Clean reply classifications
      if (prospectIds.length > 0) {
        await tx.replyClassification.deleteMany({
          where: { prospect_id: { in: prospectIds } }
        });
      }

      // Clean adhoc emails
      if (prospectIds.length > 0) {
        await tx.adhocEmail.deleteMany({
          where: { prospect_id: { in: prospectIds } }
        });
      }

      // Delete sequence steps
      if (sequenceIds.length > 0) {
        await tx.sequenceStep.deleteMany({
          where: { sequence_id: { in: sequenceIds } }
        });
      }

      // Delete sequences
      if (sequenceIds.length > 0) {
        await tx.sequence.deleteMany({
          where: { id: { in: sequenceIds } }
        });
      }

      // Delete prospects
      if (prospectIds.length > 0) {
        await tx.prospect.deleteMany({
          where: { id: { in: prospectIds } }
        });
      }

      // Delete campaigns
      if (campaignIds.length > 0) {
        await tx.campaign.deleteMany({
          where: { id: { in: campaignIds } }
        });
      }
    });

    return NextResponse.json({
      ok: true,
      timeframe,
      deleted: {
        campaigns: campaignIds.length,
        prospects: prospectIds.length,
        sequences: sequenceIds.length,
        steps: stepIds.length,
      }
    });
  } catch (error: any) {
    console.error("[POST /api/campaigns/clear-history] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to clear history" }, { status: 500 });
  }
}
