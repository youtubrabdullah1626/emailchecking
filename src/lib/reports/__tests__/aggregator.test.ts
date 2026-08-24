import { getCampaignReportData } from "../aggregator";
import prisma from "@/lib/prisma";

jest.mock("@/lib/prisma", () => ({
  campaign: {
    findUnique: jest.fn(),
  },
  trackedEmail: {
    findMany: jest.fn(),
  },
}));

describe("Phase 2: High-Performance Report Aggregator Invariants", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("handles 0 leads gracefully without NaN", async () => {
    (prisma.campaign.findUnique as jest.Mock).mockResolvedValue({
      id: "camp_empty_1",
      name: "Empty Campaign",
      status: "ACTIVE",
      created_at: new Date("2026-08-01"),
      updated_at: new Date("2026-08-24"),
      user_id: "usr_123",
      users: { name: "Apex Growth Agency", email: "agency@apex.com" },
      prospects: [],
    });

    const report = await getCampaignReportData("camp_empty_1");

    expect(report).not.toBeNull();
    expect(report?.metrics.totalContacted).toBe(0);
    expect(report?.metrics.openRate).toBe(0);
    expect(report?.metrics.replyRate).toBe(0);
    expect(report?.metrics.domainHealth).toBe(100);
    expect(report?.leadActivities).toEqual([]);
    expect(report?.summaryPoints.length).toBe(4);
    expect(report?.summaryPoints[0]).toContain("0 personalized emails");
  });

  it("calculates exact metrics, lead telemetry log, and factual narrative for active campaign", async () => {
    (prisma.campaign.findUnique as jest.Mock).mockResolvedValue({
      id: "camp_active_1",
      name: "Q3 Outbound Expansion",
      status: "ACTIVE",
      created_at: new Date("2026-08-10"),
      updated_at: new Date("2026-08-24"),
      user_id: "usr_agency_777",
      users: { name: "Apex Growth", email: "contact@apex.com" },
      prospects: [
        {
          id: "p1",
          email: "lead1@target.com",
          timezone: "America/New_York",
          status: "REPLIED",
          sequences: [
            {
              id: "s1",
              status: "REPLIED",
              assigned_sender_email: "sender@silaer.com",
              steps: [
                { id: "st1", step_number: 1, status: "SENT", sent_at: new Date("2026-08-24T14:00:00Z"), scheduled_at_utc: new Date(), delay_reason: null },
                { id: "st2", step_number: 2, status: "SENT", sent_at: new Date("2026-08-24T16:00:00Z"), scheduled_at_utc: new Date(), delay_reason: null },
              ],
            },
          ],
        },
        {
          id: "p2",
          email: "lead2@target.com",
          timezone: "Europe/London",
          status: "ACTIVE",
          sequences: [
            {
              id: "s2",
              status: "ACTIVE",
              assigned_sender_email: "sender@silaer.com",
              steps: [
                { id: "st3", step_number: 1, status: "SENT", sent_at: new Date("2026-08-24T15:00:00Z"), scheduled_at_utc: new Date(), delay_reason: null },
                { id: "st4", step_number: 2, status: "PENDING", sent_at: null, scheduled_at_utc: new Date(), delay_reason: null },
              ],
            },
          ],
        },
      ],
    });

    (prisma.trackedEmail.findMany as jest.Mock).mockResolvedValue([
      {
        source_id: "st1",
        recipient_email: "lead1@target.com",
        open_count: 2,
        first_opened_at: new Date("2026-08-24T14:30:00Z"),
        replied_at: new Date("2026-08-24T15:00:00Z"),
        bounced_at: null,
      },
    ]);

    const report = await getCampaignReportData("camp_active_1");

    expect(report).not.toBeNull();
    expect(report?.campaignName).toBe("Q3 Outbound Expansion");
    expect(report?.agencyName).toBe("Apex Growth");
    expect(report?.metrics.totalContacted).toBe(2);
    expect(report?.metrics.totalDelivered).toBe(2);
    expect(report?.metrics.realReplies).toBe(1);
    expect(report?.metrics.replyRate).toBe(50);
    expect(report?.metrics.domainHealth).toBe(100);
    expect(report?.referralUrl).toContain("ref=usr_agency_777");

    expect(report?.leadActivities.length).toBe(2);
    expect(report?.leadActivities[0].recipientEmail).toBe("lead1@target.com");
    expect(report?.leadActivities[0].status).toBe("REPLIED");
    expect(report?.leadActivities[0].leadTimezone).toBe("New York (EST)");
  });
});
