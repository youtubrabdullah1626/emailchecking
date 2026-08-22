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
    let campaign = null;

    if (params.id === "latest" || params.id === "active") {
      campaign = await prisma.campaign.findFirst({
        where: { user_id: session.user.id },
        select: { id: true, status: true },
        orderBy: { updated_at: "desc" }
      });
    } else {
      campaign = await prisma.campaign.findFirst({
        where: {
          OR: [
            { id: params.id, user_id: session.user.id },
            { name: params.id, user_id: session.user.id },
          ]
        },
        select: { id: true, status: true }
      });
    }

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
      campaign = await prisma.campaign.findFirst({
        where: { user_id: session.user.id },
        select: { id: true, status: true },
        orderBy: { updated_at: "desc" }
      });
    }

    const isOwnerOrAdmin = session.user.role === 'SUPER_ADMIN' || session.user.role === 'OWNER' || session.user.role === 'ADMIN';

    if (!campaign && isOwnerOrAdmin) {
      campaign = await prisma.campaign.findFirst({
        where: {
          OR: [
            { id: params.id },
            { name: params.id },
          ]
        },
        select: { id: true, status: true },
        orderBy: { updated_at: "desc" }
      });
      if (!campaign) {
        campaign = await prisma.campaign.findFirst({
          select: { id: true, status: true },
          orderBy: { updated_at: "desc" }
        });
      }
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

      // Fire scheduler asynchronously in the background (100% non-blocking)
      import("@/lib/scheduler/run").then(async ({ runScheduler }) => {
        const { sendBatch } = await import("@/lib/gmail/sender");
        const schedResult = await runScheduler({ dryRun: false, maxClaims: 50 });
        if (schedResult.claimedStepIds && schedResult.claimedStepIds.length > 0) {
          await sendBatch(schedResult.claimedStepIds);
        }
      }).catch((schedErr) => {
        console.error("[CAMPAIGN_RESUME] Background scheduler run warning:", schedErr);
      });

      return NextResponse.json({ ok: true, message: "Campaign resumed successfully", activeCount: result.activeCount });
    }

    return NextResponse.json({ ok: false, error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("Failed to update campaign lifecycle status", error);
    return NextResponse.json({ ok: false, error: error.message || "Failed to update campaign" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
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

  const resolvedParams = await Promise.resolve(params);
  const targetId = resolvedParams?.id;

  if (!targetId) {
    return NextResponse.json({ ok: false, error: "Campaign ID required" }, { status: 400 });
  }

  try {
    // 1. Resolve campaign
    let campaign = await prisma.campaign.findFirst({
      where: {
        OR: [
          { id: targetId, user_id: userId },
          { name: targetId, user_id: userId },
        ]
      },
      select: { id: true, name: true }
    });

    if (!campaign) {
      // Check import job
      const job = await prisma.importJob.findFirst({
        where: { id: targetId, userId: userId },
        select: { campaignId: true }
      });
      if (job?.campaignId) {
        campaign = await prisma.campaign.findFirst({
          where: { id: job.campaignId, user_id: userId },
          select: { id: true, name: true }
        });
      }
    }

    if (!campaign) {
      return NextResponse.json({ ok: false, error: "Campaign not found" }, { status: 404 });
    }

    const campaignId = campaign.id;

    // 2. Resolve all related records
    const prospects = await prisma.prospect.findMany({
      where: { campaign_id: campaignId },
      select: { id: true, email: true }
    });
    const prospectIds = prospects.map(p => p.id);
    const prospectEmails = prospects.map(p => p.email.toLowerCase());

    const sequences = await prisma.sequence.findMany({
      where: { prospect_id: { in: prospectIds } },
      select: { id: true }
    });
    const sequenceIds = sequences.map(s => s.id);

    const steps = await prisma.sequenceStep.findMany({
      where: { sequence_id: { in: sequenceIds } },
      select: { id: true }
    });
    const stepIds = steps.map(s => s.id);

    // 3. Atomically cascade delete in single transaction
    await prisma.$transaction(async (tx) => {
      if (stepIds.length > 0 || prospectEmails.length > 0) {
        await tx.trackedEmail.deleteMany({
          where: {
            OR: [
              ...(stepIds.length > 0 ? [{ source_id: { in: stepIds } }] : []),
              ...(prospectEmails.length > 0 ? [{ recipient_email: { in: prospectEmails, mode: "insensitive" as any } }] : []),
            ]
          }
        });
      }

      if (prospectIds.length > 0) {
        await tx.replyClassification.deleteMany({
          where: { prospect_id: { in: prospectIds } }
        });
        await tx.adhocEmail.deleteMany({
          where: { prospect_id: { in: prospectIds } }
        });
      }

      if (sequenceIds.length > 0) {
        await tx.sequenceStep.deleteMany({
          where: { sequence_id: { in: sequenceIds } }
        });
        await tx.sequence.deleteMany({
          where: { id: { in: sequenceIds } }
        });
      }

      if (prospectIds.length > 0) {
        await tx.prospect.deleteMany({
          where: { id: { in: prospectIds } }
        });
      }

      await tx.campaign.delete({
        where: { id: campaignId }
      });
    });

    return NextResponse.json({
      ok: true,
      message: `Campaign "${campaign.name}" deleted successfully`,
      deletedCampaignId: campaignId
    });
  } catch (error: any) {
    console.error("[DELETE /api/campaigns/[id]] Error:", error);
    return NextResponse.json({ ok: false, error: error.message || "Failed to delete campaign" }, { status: 500 });
  }
}
