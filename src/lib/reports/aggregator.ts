import prisma from "@/lib/prisma";
import { ClientReportData, ClientReportMetrics, ReportLeadActivity } from "./types";
import { generateReportToken } from "./token";

function normalizeTimezoneName(tz?: string | null): string {
  if (!tz || tz === "UTC" || tz === "GMT" || tz.toLowerCase().includes("london") || tz.toLowerCase().includes("europe/london")) {
    return "London (GMT)";
  }
  if (tz.includes("New_York") || tz.includes("EST") || tz.includes("EDT")) {
    return "New York (EST)";
  }
  if (tz.includes("Los_Angeles") || tz.includes("PST") || tz.includes("PDT")) {
    return "San Francisco (PST)";
  }
  if (tz.includes("Chicago") || tz.includes("CST") || tz.includes("CDT")) {
    return "Chicago (CST)";
  }
  return tz.replace(/_/g, " ");
}

function resolveIanaTimezone(tz?: string | null): string {
  if (!tz || tz === "UTC" || tz === "GMT" || tz.toLowerCase().includes("london")) {
    return "Europe/London";
  }
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return tz;
  } catch {
    return "Europe/London";
  }
}

function formatDateTimeInTz(date: Date | string | null | undefined, tz?: string | null): string | null {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  const iana = resolveIanaTimezone(tz);

  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: iana,
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    return formatter.format(d);
  } catch {
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const m = monthNames[d.getMonth()];
    const day = d.getDate();
    let hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    return `${m} ${day}, ${hours}:${minutes} ${ampm}`;
  }
}

/**
 * Aggregates campaign data into an executive-ready, sanitized client report
 * complete with lead journey telemetry audit log.
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
            email: true,
            timezone: true,
            status: true,
            created_at: true,
            sequences: {
              take: 1,
              orderBy: { created_at: "desc" },
              select: {
                id: true,
                status: true,
                assigned_sender_email: true,
                steps: {
                  orderBy: { step_number: "asc" },
                  select: {
                    id: true,
                    step_number: true,
                    status: true,
                    sent_at: true,
                    scheduled_at_utc: true,
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

    const allStepIds = campaign.prospects.flatMap((p) =>
      (p.sequences[0]?.steps || []).map((s) => s.id)
    );

    // Fetch tracking telemetry for all steps
    let trackedEmailsMap = new Map<string, any>();
    try {
      if (allStepIds.length > 0 && prisma.trackedEmail) {
        const tracked = await prisma.trackedEmail.findMany({
          where: {
            source_id: { in: allStepIds },
          },
          select: {
            source_id: true,
            recipient_email: true,
            open_count: true,
            first_opened_at: true,
            replied_at: true,
            bounced_at: true,
          },
        });
        for (const item of tracked) {
          if (item.source_id) {
            trackedEmailsMap.set(item.source_id, item);
          }
          if (item.recipient_email) {
            trackedEmailsMap.set(item.recipient_email, item);
          }
        }
      }
    } catch {
      // Fallback
    }

    const leadActivities: ReportLeadActivity[] = [];

    for (const prospect of campaign.prospects) {
      if (prospect.status === "REPLIED") {
        realReplies++;
      }

      const seq = prospect.sequences[0];
      const steps = seq?.steps || [];
      const primaryStep = steps.find((s) => s.status === "SENT" || s.sent_at) || steps[0];
      const assignedSender = seq?.assigned_sender_email || campaign.users?.email || "outreach@silaer.com";
      const leadTz = prospect.timezone || "Europe/London";

      let isDelivered = false;
      for (const step of steps) {
        if (step.status === "SENT" || step.sent_at) {
          if (step.step_number === 1) {
            totalDelivered++;
            isDelivered = true;
          }
        }
        if (step.status === "FAILED" && step.delay_reason?.toLowerCase().includes("bounce")) {
          bounces++;
        }
      }

      // Resolve tracking data
      const tracking = (primaryStep && trackedEmailsMap.get(primaryStep.id)) || trackedEmailsMap.get(prospect.email);
      const openCount = tracking?.open_count || (prospect.status === "REPLIED" ? 1 : 0);
      const firstOpened = tracking?.first_opened_at || (prospect.status === "REPLIED" ? primaryStep?.sent_at : null);
      const repliedAtDate = tracking?.replied_at || (prospect.status === "REPLIED" ? primaryStep?.sent_at : null);

      let leadStatus: "REPLIED" | "OPENED" | "SENT" | "SCHEDULED" | "BOUNCED" = "SCHEDULED";
      if (prospect.status === "REPLIED" || repliedAtDate) {
        leadStatus = "REPLIED";
      } else if (openCount > 0) {
        leadStatus = "OPENED";
      } else if (isDelivered || primaryStep?.status === "SENT" || primaryStep?.sent_at) {
        leadStatus = "SENT";
      } else if (primaryStep?.status === "FAILED" && primaryStep.delay_reason?.toLowerCase().includes("bounce")) {
        leadStatus = "BOUNCED";
      }

      leadActivities.push({
        id: prospect.id,
        recipientEmail: prospect.email,
        senderInbox: assignedSender,
        leadTimezone: normalizeTimezoneName(leadTz),
        stepNumber: primaryStep?.step_number || 1,
        dispatchedAt: formatDateTimeInTz(primaryStep?.sent_at || (leadStatus !== "SCHEDULED" ? primaryStep?.scheduled_at_utc : null), leadTz),
        openedAt: formatDateTimeInTz(firstOpened, leadTz),
        openCount,
        repliedAt: formatDateTimeInTz(repliedAtDate, leadTz),
        status: leadStatus,
      });
    }

    const totalOpened = leadActivities.filter((l) => l.openCount > 0 || l.status === "OPENED" || l.status === "REPLIED").length;
    const deliveryRate = totalContacted > 0 ? Number(((totalDelivered / totalContacted) * 100).toFixed(0)) : 100;
    const openRate = totalContacted > 0 ? Number(((totalOpened / totalContacted) * 100).toFixed(0)) : 0;
    const replyRate = totalContacted > 0 ? Number(((realReplies / totalContacted) * 100).toFixed(0)) : 0;

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

    // Format Date Range cleanly (Avoids "Aug 24 - 24, 2026")
    const startDate = new Date(campaign.created_at);
    const endDate = new Date(campaign.updated_at);
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    let dateRange = "";
    if (startDate.toDateString() === endDate.toDateString()) {
      dateRange = `${monthNames[startDate.getMonth()]} ${startDate.getDate()}, ${startDate.getFullYear()}`;
    } else if (startDate.getMonth() === endDate.getMonth() && startDate.getFullYear() === endDate.getFullYear()) {
      dateRange = `${monthNames[startDate.getMonth()]} ${startDate.getDate()} – ${endDate.getDate()}, ${startDate.getFullYear()}`;
    } else {
      dateRange = `${monthNames[startDate.getMonth()]} ${startDate.getDate()}, ${startDate.getFullYear()} – ${monthNames[endDate.getMonth()]} ${endDate.getDate()}, ${endDate.getFullYear()}`;
    }

    // Agency / Client Names
    const agencyName = campaign.users?.name || (campaign.users?.email ? campaign.users.email.split("@")[0] : "Outreach Partner");
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
      leadActivities,
      summaryPoints,
      referralUrl,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("[getCampaignReportData] Aggregation error:", error);
    return null;
  }
}
