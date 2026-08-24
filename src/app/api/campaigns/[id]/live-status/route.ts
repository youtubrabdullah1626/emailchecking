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
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resolvedParams = await Promise.resolve(params);
    const targetId = resolvedParams?.id || "latest";

    const campaign = await prisma.campaign.findFirst({
      where: (targetId === "latest" || targetId === "active")
        ? { user_id: userId }
        : { id: targetId, user_id: userId },
      orderBy: { updated_at: "desc" },
      select: {
        id: true,
        status: true,
        name: true,
        prospects: {
          select: {
            id: true,
            email: true,
            name: true,
            status: true,
            sequences: {
              orderBy: { created_at: "desc" },
              take: 1,
              select: {
                id: true,
                status: true,
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
                  orderBy: { step_number: "asc" },
                }
              }
            }
          }
        }
      }
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const campaignId = campaign.id;

    // Flatten all steps from the latest sequences
    const stepsWithSeq: any[] = [];
    for (const prospect of campaign.prospects) {
      const latestSeq = prospect.sequences[0];
      if (latestSeq) {
        for (const step of latestSeq.steps) {
          stepsWithSeq.push({
            ...step,
            sequence: {
              id: latestSeq.id,
              status: latestSeq.status,
              prospect: {
                id: prospect.id,
                email: prospect.email,
                name: prospect.name,
                status: prospect.status,
              }
            }
          });
        }
      }
    }

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

    // Check if campaign_pause_resume feature is enabled
    const pauseFlag = await prisma.feature_flags.findFirst({
      where: { key: "campaign_pause_resume" },
      select: { enabled: true },
    }).catch(() => null);
    const pauseResumeEnabled = pauseFlag ? pauseFlag.enabled : true;

    // When pause/resume is disabled: auto-heal any PAUSED campaign to ACTIVE in DB
    if (!pauseResumeEnabled && campaign.status === "PAUSED") {
      campaign.status = "ACTIVE";
      prisma.campaign.update({ where: { id: campaign.id }, data: { status: "ACTIVE" } }).catch(() => {});
      prisma.sequence.updateMany({
        where: { prospect: { campaign_id: campaign.id }, status: "PAUSED" },
        data: { status: "ACTIVE" }
      }).catch(() => {});
    }

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

      if (pauseResumeEnabled && (campaign?.status === "PAUSED" || step.sequence.status === "PAUSED")) {
        if (["SENT", "OPENED", "REPLIED", "FAILED", "CANCELLED", "SKIPPED"].includes(step.status)) {
          return step.status === "FAILED" ? "BOUNCED" : (step.status === "SKIPPED" ? "CANCELLED" : step.status);
        }
        return "PAUSED";
      }

      if (step.delay_reason === "DAILY_LIMIT_REACHED" && step.status === "RETRYABLE_FAILURE") {
        if (step.retry_at && new Date(step.retry_at).getTime() > Date.now()) {
          return "DAILY_LIMIT_REACHED";
        }
        return "SCHEDULED";
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

    // Fetch user's home timezone from the users table
    const userRecord = await prisma.users.findFirst({
      where: { id: userId },
      select: { timezone: true },
    }).catch(() => null);

    const userTimezone = userRecord?.timezone || "UTC";

    return NextResponse.json({
      campaignId,
      campaignStatus: campaign.status,
      campaignName: campaign.name,
      userTimezone,
      stats: { sent: sentCount, opened: openedCount, replied: repliedCount, failed: failedCount },
      items,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[GET /api/campaigns/[id]/live-status] Error:", error);
    return NextResponse.json({ error: "Failed to fetch live status" }, { status: 500 });
  }
}
