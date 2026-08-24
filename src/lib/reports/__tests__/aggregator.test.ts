import { getCampaignReportData } from "../aggregator";
import prisma from "@/lib/prisma";

jest.mock("@/lib/prisma", () => ({
  campaign: {
    findUnique: jest.fn(),
  },
  emailEvent: {
    count: jest.fn(),
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
    expect(report?.summaryPoints.length).toBe(4);
    expect(report?.summaryPoints[0]).toContain("0 leads");
  });

  it("calculates exact metrics and factual narrative for active campaign", async () => {
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
          status: "REPLIED",
          sequences: [
            {
              id: "s1",
              status: "REPLIED",
              steps: [
                { id: "st1", step_number: 1, status: "SENT", sent_at: new Date(), delay_reason: null },
                { id: "st2", step_number: 2, status: "SENT", sent_at: new Date(), delay_reason: null },
              ],
            },
          ],
        },
        {
          id: "p2",
          status: "ACTIVE",
          sequences: [
            {
              id: "s2",
              status: "ACTIVE",
              steps: [
                { id: "st3", step_number: 1, status: "SENT", sent_at: new Date(), delay_reason: null },
                { id: "st4", step_number: 2, status: "PENDING", sent_at: null, delay_reason: null },
              ],
            },
          ],
        },
      ],
    });

    (prisma.emailEvent.count as jest.Mock).mockResolvedValue(2);

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
  });
});
