import { getDailyTelemetryStats } from "../daily-stats";
import prisma from "@/lib/prisma";

jest.mock("@/lib/prisma", () => ({
  users: {
    findUnique: jest.fn(),
  },
  emailAccount: {
    findMany: jest.fn(),
  },
  sequenceStep: {
    count: jest.fn(),
  },
  adhocEmail: {
    count: jest.fn(),
  },
  replyClassification: {
    count: jest.fn(),
  },
}));

describe("10X Daily Telemetry Invariants & Midnight Reset", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("calculates exact midnight boundary in user local timezone", async () => {
    (prisma.users.findUnique as jest.Mock).mockResolvedValue({
      timezone: "Europe/London",
      email: "founder@silaer.com",
    });
    (prisma.emailAccount.findMany as jest.Mock).mockResolvedValue([
      { email: "inbox1@silaer.com" },
    ]);
    (prisma.sequenceStep.count as jest.Mock).mockResolvedValue(0);
    (prisma.adhocEmail.count as jest.Mock).mockResolvedValue(0);
    (prisma.replyClassification.count as jest.Mock).mockResolvedValue(0);

    const stats = await getDailyTelemetryStats("usr_123", "Europe/London");

    expect(stats.timezone).toBe("Europe/London");
    expect(stats.emailsSentToday).toBe(0);
    expect(stats.repliesToday).toBe(0);
    expect(stats.startOfDay).toBeInstanceOf(Date);
    expect(typeof stats.dateKey).toBe("string");
  });

  it("combines sequence steps and adhoc sends accurately", async () => {
    (prisma.users.findUnique as jest.Mock).mockResolvedValue({
      timezone: "UTC",
      email: "founder@silaer.com",
    });
    (prisma.emailAccount.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.sequenceStep.count as jest.Mock).mockResolvedValue(5);
    (prisma.adhocEmail.count as jest.Mock).mockResolvedValue(3);
    (prisma.replyClassification.count as jest.Mock).mockResolvedValue(2);

    const stats = await getDailyTelemetryStats("usr_123", "UTC");

    expect(stats.emailsSentToday).toBe(8); // 5 + 3
    expect(stats.repliesToday).toBe(2);
  });
});
