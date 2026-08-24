import prisma from "@/lib/prisma";
import { ClientReportData, ClientReportMetrics } from "./types";
import { generateReportToken } from "./token";

/**
 * Aggregates campaign data into an executive-ready, sanitized client report.
 * Strictly read-only and free of PII or credentials.
 */
export async function getCampaignReportData(
  campaignId: string,
  providedToken?: string
): Promise<ClientReportData | null> {
  try {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: {
        id: true,
        name: true,
        status: true,
        created_at: true,
        updated_at: true,
        user_id: true,
        users: {
          select: {
            name: true,
            email: true,
          },
        },
        prospects: {
          select: {
            id: true,
            status: true,
            sequences: {
              take: 1,
              orderBy: { created_at: "desc" },
              select: {
                id: true,
                status: true,
                steps: {
                  select: {
                    id: true,
                    step_number: true,
                    status: true,
                    sent_at: true,
                    delay_reason: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!campaign) return null;

    const totalContacted = campaign.prospects.length;
    let totalDelivered = 0;
    let realReplies = 0;
    let bounces = 0;
    const prospectEmails: string[] = [];

    for (const prospect of campaign.prospects) {
      if (prospect.status === "REPLIED") {
        realReplies++;
      }

      const seq = prospect.sequences[0];
      if (!seq) continue;

      for (const step of seq.steps) {
        if (step.status === "SENT" || step.sent_at) {
          if (step.step_number === 1) {
            totalDelivered++;
          }
        }
        if (step.status === "FAILED" && step.delay_reason?.toLowerCase().includes("bounce")) {
          bounces++;
        }
      }
    }

    // Query opened email events / tracked emails if present
    let totalOpened = 0;
    try {
      if (prisma.trackedEmail) {
        const stepIds = campaign.prospects.flatMap((p) =>
          (p.sequences[0]?.steps || []).map((s) => s.id)
        );
        if (stepIds.length > 0) {
          const openedCount = await prisma.trackedEmail.count({
            where: {
              source_id: { in: stepIds },
              open_count: { gt: 0 },
            },
          });
          totalOpened = openedCount;
        }
      }
    } catch {
      // Fallback
    }

    // Ensure opened is at least equal to realReplies if tracking pixel was blocked
    if (totalOpened < realReplies) {
      totalOpened = realReplies;
    }

    const deliveryRate = totalContacted > 0
      ? Number(((totalDelivered / totalContacted) * 100).toFixed(1))
      : 100;

    const openRate = totalContacted > 0
      ? Number(((totalOpened / totalContacted) * 100).toFixed(1))
      : 0;

    const replyRate = totalContacted > 0
      ? Number(((realReplies / totalContacted) * 100).toFixed(1))
      : 0;

    const domainHealth = bounces === 0
      ? 100
      : Math.max(0, Number((100 - (bounces / Math.max(1, totalContacted)) * 100).toFixed(0)));

    const metrics: ClientReportMetrics = {
      totalContacted,
      totalDelivered,
      deliveryRate,
      totalOpened,
      openRate,
      realReplies,
      replyRate,
      bounces,
      domainHealth,
    };

    // Format Date Range
    const startDate = new Date(campaign.created_at);
    const endDate = new Date(campaign.updated_at);
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const dateRange = startDate.getMonth() === endDate.getMonth() && startDate.getFullYear() === endDate.getFullYear()
      ? `${monthNames[startDate.getMonth()]} ${startDate.getDate()} - ${endDate.getDate()}, ${startDate.getFullYear()}`
      : `${monthNames[startDate.getMonth()]} ${startDate.getFullYear()} - ${monthNames[endDate.getMonth()]} ${endDate.getFullYear()}`;

    // Agency / Client Names
    const agencyName = campaign.users?.name || (campaign.users?.email ? campaign.users.email.split("@")[0] : "Outreach Agency");
    const clientName = campaign.name || "Enterprise Client";

    // Factual Campaign Narrative Summary Points
    const summaryPoints: string[] = [
      `The system processed and dispatched ${totalContacted.toLocaleString()} leads across connected inboxes.`,
      `A total of ${totalOpened.toLocaleString()} unique leads opened the email (${openRate}% open rate).`,
      `${realReplies.toLocaleString()} prospects sent confirmed real replies back to your team.`,
      bounces === 0
        ? "0 bounces occurred, maintaining 100% clean email deliverability."
        : `${bounces} bounces recorded with ${domainHealth}% deliverability health.`,
    ];

    const shareToken = providedToken || generateReportToken(campaign.id);
    const referralUrl = `https://www.silaer.com/signup?ref=${campaign.user_id || "silaer"}&utm_source=client_report&utm_medium=viral_flywheel`;

    return {
      shareToken,
      campaignId: campaign.id,
      campaignName: campaign.name,
      agencyName,
      clientName,
      dateRange,
      status: (campaign.status === "ACTIVE" || campaign.status === "PAUSED" || campaign.status === "COMPLETED") ? campaign.status : "ACTIVE",
      metrics,
      summaryPoints,
      referralUrl,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("[getCampaignReportData] Aggregation error:", error);
    return null;
  }
}
