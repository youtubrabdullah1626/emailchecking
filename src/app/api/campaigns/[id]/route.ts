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

    // ── Fast Campaign Resolver ────────────────────────────────────────────────
    // When the frontend sends an exact UUID (always true after approveImport sets
    // localStorage), this is a SINGLE indexed lookup — very fast.
    // Only falls back to slower queries when UUID is unavailable.
    let campaign: { id: string; status: string } | null = null;
    const id = params.id;
    const userId = session.user.id;

    if (id === "latest" || id === "active") {
      // Explicit "latest" — one query, ordered by updated_at
      campaign = await prisma.campaign.findFirst({
        where: { user_id: userId },
        select: { id: true, status: true },
        orderBy: { updated_at: "desc" }
      });
    } else {
      // Try exact UUID match first (fastest — indexed primary key)
      campaign = await prisma.campaign.findFirst({
        where: { id, user_id: userId },
        select: { id: true, status: true },
      });

      // Fallback: campaignName sent in body
      if (!campaign && campaignName) {
        campaign = await prisma.campaign.findFirst({
          where: { name: campaignName, user_id: userId },
          select: { id: true, status: true },
          orderBy: { created_at: "desc" }
        });
      }

      // Last resort: most-recently-updated campaign for this user
      if (!campaign) {
        campaign = await prisma.campaign.findFirst({
          where: { user_id: userId },
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
      // Step 1: Immediately reset PROCESSING steps → PENDING + release reserved_count
      // This is the critical "emergency brake" — do it FIRST before anything else
      await prisma.$executeRaw`
        WITH reset_steps AS (
          UPDATE sequence_steps s
          SET status = 'PENDING', claimed_at = NULL
          FROM sequences seq
          JOIN prospects p ON seq.prospect_id = p.id
          WHERE s.sequence_id = seq.id
            AND p.campaign_id = ${resolvedCampaignId}
            AND s.status = 'PROCESSING'
          RETURNING seq.assigned_sender_email
        )
        UPDATE email_accounts ea
        SET reserved_count = GREATEST(0, ea.reserved_count - (
          SELECT COUNT(*) FROM reset_steps rs WHERE rs.assigned_sender_email = ea.email
        ))
        WHERE ea.email IN (SELECT assigned_sender_email FROM reset_steps WHERE assigned_sender_email IS NOT NULL)
      `.catch(() => {});

      // Step 2: Mark campaign PAUSED immediately so sender.ts live re-read sees it
      await prisma.campaign.update({ where: { id: resolvedCampaignId }, data: { status: 'PAUSED' } });

      // Step 3: Return success NOW — no waiting for sequence updates
      // Sequence pause runs in background (non-critical for the brake, just for state cleanup)
      prisma.$executeRaw`
        UPDATE sequences seq
        SET status = 'PAUSED'
        FROM prospects p
        WHERE seq.prospect_id = p.id
          AND p.campaign_id = ${resolvedCampaignId}
          AND seq.status NOT IN ('COMPLETED', 'STOPPED')
      `.catch(() => {});

      return NextResponse.json({ ok: true, status: "PAUSED", message: "Campaign paused successfully" });
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
  const userId = session?.user?.id;

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
        // Release reserved capacity if any steps were in PROCESSING
        await tx.$executeRaw`
          WITH proc_steps AS (
            SELECT seq.assigned_sender_email, COUNT(*) as cnt
            FROM sequence_steps s
            JOIN sequences seq ON s.sequence_id = seq.id
            JOIN prospects p ON seq.prospect_id = p.id
            WHERE p.campaign_id = ${campaignId}
              AND s.status = 'PROCESSING'
              AND seq.assigned_sender_email IS NOT NULL
            GROUP BY seq.assigned_sender_email
          )
          UPDATE email_accounts ea
          SET reserved_count = GREATEST(0, ea.reserved_count - ps.cnt)
          FROM proc_steps ps
          WHERE ea.email = ps.assigned_sender_email
        `.catch(() => {});

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
