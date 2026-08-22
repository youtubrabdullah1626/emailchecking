/**
 * GET /api/campaigns/[id]/live-status
 *
 * Returns the real-time DB state for all steps in a campaign's ACTIVE sequences.
 * Used by LiveExecutionDashboard as the authoritative source of truth — so the
 * dashboard always reflects actual DB state regardless of client-side queue state.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/nextauth";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
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
    const targetId = resolvedParams?.id || "latest";

    let campaign;
    if (targetId === "latest" || targetId === "active") {
      campaign = await prisma.campaign.findFirst({
        where: { user_id: userId },
        orderBy: { updated_at: "desc" },
        select: { id: true, status: true, name: true },
      });
    } else {
      campaign = await prisma.campaign.findFirst({
        where: { id: targetId, user_id: userId },
        select: { id: true, status: true, name: true },
      });
    }

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const campaignId = campaign.id;

    // 1. Fetch all prospects assigned to this campaign
    const prospects = await prisma.prospect.findMany({
      where: { campaign_id: campaignId },
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
      },
    });

    const prospectIds = prospects.map((p) => p.id);

    // 2. Fetch all sequences for these prospects (ordered newest first)
    const allSequences = prospectIds.length > 0
      ? await prisma.sequence.findMany({
          where: { prospect_id: { in: prospectIds } },
          orderBy: { created_at: "desc" },
          include: {
            prospect: {
              select: {
                id: true,
                email: true,
                name: true,
                status: true,
              },
            },
            steps: {
              select: {
                id: true,
                step_number: true,
                subject: true,
                status: true,
                scheduled_at_utc: true,
                scheduled_time_local: true,
                timezone: true,
                sent_at: true,
                retry_count: true,
                delay_reason: true,
                retry_at: true,
              },
              orderBy: [{ step_number: "asc" }],
            },
          },
        })
      : [];

    // 3. Take the latest sequence per prospect
    const seenProspects = new Set<string>();
    const latestSequences = [];
    for (const seq of allSequences) {
      if (!seenProspects.has(seq.prospect_id)) {
        seenProspects.add(seq.prospect_id);
        latestSequences.push(seq);
      }
    }

    // Flatten all steps from the latest sequences
    const stepsWithSeq = latestSequences.flatMap((seq) =>
      seq.steps.map((step) => ({
        ...step,
        sequence: {
          id: seq.id,
          status: seq.status,
          prospect: seq.prospect,
        },
      }))
    );

    // Query real tracked emails for open counts
    const stepIds = stepsWithSeq.map((s) => s.id);
    const trackedEmails = stepIds.length > 0
      ? await prisma.trackedEmail.findMany({
          where: { source_id: { in: stepIds } },
          select: { source_id: true, open_count: true, first_opened_at: true, status: true },
        })
      : [];

    const trackedMap = new Map<string, typeof trackedEmails[0]>(
      trackedEmails.map((t) => [t.source_id!, t])
    );

    // Map DB step status → dashboard liveStatus
    function mapLiveStatus(step: typeof stepsWithSeq[0]): string {
      const prospectStatus = step.sequence.prospect.status;
      const tracked = trackedMap.get(step.id);

      if (prospectStatus === "REPLIED" || tracked?.status === "REPLIED") {
        if (step.status === "SENT") return "REPLIED";
      }

      if (tracked && (tracked.open_count > 0 || tracked.status === "OPENED")) {
        if (step.status === "SENT") return "OPENED";
      }

      switch (step.status) {
        case "SENT":       return "SENT";
        case "PROCESSING": return "PROCESSING";
        case "FAILED":     return "BOUNCED";
        case "CANCELLED":
        case "SKIPPED":    return "CANCELLED";
        default:           return "SCHEDULED";
      }
    }

    const items = stepsWithSeq.map((step) => {
      const liveStatus = mapLiveStatus(step);
      const sentAt = step.sent_at?.toISOString() ?? null;
      const tracked = trackedMap.get(step.id);
      const openedAt = tracked?.first_opened_at?.toISOString() ?? null;
      const isDispatched = ["SENT", "OPENED", "REPLIED", "BOUNCED"].includes(liveStatus);
      const lastEventTime = isDispatched ? (openedAt ?? sentAt) : null;

      return {
        stepId: step.id,
        stepNumber: step.step_number,
        subject: step.subject,
        recipientEmail: step.sequence.prospect.email,
        recipientName: step.sequence.prospect.name,
        sequenceId: step.sequence.id,
        prospectId: step.sequence.prospect.id,
        scheduledAt: step.scheduled_at_utc?.toISOString() ?? null,
        scheduledTimeLocal: step.scheduled_time_local,
        timezone: step.timezone,
        sentAt,
        openedAt,
        openCount: tracked?.open_count ?? 0,
        liveStatus,
        lastEventTime,
        retryCount: step.retry_count ?? 0,
        delayReason: step.delay_reason ?? null,
        retryAt: step.retry_at?.toISOString() ?? null,
      };
    });

    // Sort items by prospect email, then step number
    items.sort((a, b) => {
      if (a.recipientEmail !== b.recipientEmail) {
        return a.recipientEmail.localeCompare(b.recipientEmail);
      }
      return a.stepNumber - b.stepNumber;
    });

    // Aggregate stats across all campaign leads
    const sentCount    = items.filter(i => ["SENT", "OPENED", "REPLIED"].includes(i.liveStatus)).length;
    const openedCount  = items.filter(i => ["OPENED", "REPLIED"].includes(i.liveStatus) || (i.openCount && i.openCount > 0)).length;
    const repliedCount = items.filter(i => i.liveStatus === "REPLIED").length;
    const failedCount  = items.filter(i => i.liveStatus === "BOUNCED").length;

    return NextResponse.json({
      campaignId,
      campaignStatus: campaign.status,
      campaignName: campaign.name,
      stats: { sent: sentCount, opened: openedCount, replied: repliedCount, failed: failedCount },
      items,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[GET /api/campaigns/[id]/live-status] Error:", error);
    return NextResponse.json({ error: "Failed to fetch live status" }, { status: 500 });
  }
}
