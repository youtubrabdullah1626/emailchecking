import { canSendEmail, recordSuccessfulSend } from "../lib/reputation/guard";
import { reportSystemError, resolveSystemError } from "../lib/intelligence/error-engine";
import { dispatchAlert } from "../lib/intelligence/alerts";
import { getSystemHealth } from "../lib/health/system";
import { getDatabaseHealth } from "../lib/health/database";
import { getGmailHealth } from "../lib/health/gmail";
import { getAIHealth } from "../lib/health/ai";
import prisma from "../lib/prisma";

// ── Mock Prisma ───────────────────────────────────────────────────────────────
jest.mock("../lib/prisma", () => ({
  __esModule: true,
  default: {
    systemError: {
      findFirst: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
    },
    emailAccount: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    emailEvent: {
      findFirst: jest.fn(),
      count: jest.fn(),
    },
    $queryRaw: jest.fn(),
  },
}));

const mockPrisma = prisma as unknown as {
  systemError: any;
  emailAccount: any;
  emailEvent: any;
  $queryRaw: any;
};

// ── Mock OAuth Config ─────────────────────────────────────────────────────────
jest.mock("../lib/gmail/oauth", () => ({
  getOAuthConfig: jest.fn().mockReturnValue({ senderEmail: "test@example.com" }),
}));

describe("Phase 12: Enterprise Observability & Intelligence", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Health Intelligence Center", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });
    it("returns correctly formatted system health", async () => {
      const health = await getSystemHealth();
      expect(health.status).toBe("healthy");
      expect(health.uptime).toMatch(/\d+d \d+h \d+m/);
      expect(health.memoryUsageMb).toBeGreaterThan(0);
      expect(health.responseLatencyMs).toBe(0); // Populated at route level
    });

    it("evaluates database health and latency", async () => {
      mockPrisma.$queryRaw.mockResolvedValueOnce([{ "?column?": 1 }]);
      mockPrisma.systemError.count.mockResolvedValueOnce(0);

      const health = await getDatabaseHealth();
      expect(health.status).toBe("connected");
      expect(health.queryLatencyMs).toBeGreaterThanOrEqual(0);
      expect(health.healthScore).toBe(100);
    });

    it("evaluates database failure", async () => {
      mockPrisma.$queryRaw.mockRejectedValueOnce(new Error("Connection failed"));
      const health = await getDatabaseHealth();
      expect(health.status).toBe("disconnected");
      expect(health.healthScore).toBe(0);
      expect(health.healthCategory).toBe("Critical");
    });

    it("evaluates Gmail health structure", async () => {
      process.env.GMAIL_SENDER_EMAIL = "test@example.com";
      mockPrisma.emailEvent.findFirst.mockResolvedValueOnce({ occurred_at: new Date() });
      mockPrisma.emailEvent.count.mockResolvedValue(0);
      mockPrisma.emailAccount.findUnique.mockResolvedValueOnce({ health_score: 100 });

      const health = await getGmailHealth();
      expect(health.status).toBe("connected");
      expect(health.dailyCapacity).toBe(300);
      expect(health.healthScore).toBe(100);
    });

    it("evaluates AI health", async () => {
      mockPrisma.systemError.count.mockResolvedValueOnce(0);
      const health = await getAIHealth();
      expect(["available", "unavailable"]).toContain(health.status);
      expect(typeof health.failureCount).toBe("number");
    });
  });

  describe("Intelligent Error Management Engine", () => {
    it("interprets raw Gmail 429 error correctly and creates incident", async () => {
      mockPrisma.systemError.findFirst.mockResolvedValueOnce(null);
      mockPrisma.systemError.create.mockResolvedValueOnce({
        id: "err-123",
        errorType: "GMAIL_RATE_LIMIT",
        severity: "HIGH",
        count: 1
      });

      const err = await reportSystemError({
        service: "gmail",
        originalError: new Error("Request failed with status code 429 rate limit exceeded"),
        impactSize: 5
      });
      
      expect(mockPrisma.systemError.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          errorType: "GMAIL_RATE_LIMIT",
          severity: "HIGH"
        })
      }));
      expect(err.errorType).toBe("GMAIL_RATE_LIMIT");
    });

    it("groups duplicate unresolved errors and increments count", async () => {
      mockPrisma.systemError.findFirst.mockResolvedValueOnce({
        id: "err-456",
        count: 5,
        severity: "HIGH"
      });
      mockPrisma.systemError.update.mockResolvedValueOnce({
        id: "err-456",
        count: 6,
        severity: "HIGH"
      });

      const err = await reportSystemError({
        service: "test_service" as any,
        originalError: new Error("Test anomaly"),
      });
      
      expect(mockPrisma.systemError.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: "err-456" }
      }));
      expect(err.count).toBe(6);
    });

    it("resolves an error manually", async () => {
      mockPrisma.systemError.update.mockResolvedValueOnce({ resolved: true });
      const resolved = await resolveSystemError("err-123");
      expect(resolved.resolved).toBe(true);
    });
  });

  describe("Alert System", () => {
    it("dispatches critical alerts to structured logs", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      
      await dispatchAlert({
        title: "Test Alert",
        description: "Something exploded",
        severity: "CRITICAL",
        service: "test_service"
      });

      expect(consoleSpy).toHaveBeenCalled();
      const payload = JSON.parse(consoleSpy.mock.calls[0][0]);
      expect(payload.type).toBe("SYSTEM_ALERT_DISPATCH");
      expect(payload.embeds[0].color).toBe(0xff0000);
      
      consoleSpy.mockRestore();
    });

    it("suppresses low severity alerts from external dispatch", async () => {
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      const consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
      
      await dispatchAlert({
        title: "Test Alert",
        description: "Minor hiccup",
        severity: "LOW",
        service: "test_service"
      });

      expect(consoleErrorSpy).not.toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalled();
      
      consoleErrorSpy.mockRestore();
      consoleLogSpy.mockRestore();
    });
  });

  describe("Email Reputation Protection Guard", () => {
    const testEmail = "test@example.com";

    it("allows sending for a fresh account", async () => {
      mockPrisma.emailAccount.findUnique.mockResolvedValueOnce({
        sent_today: 0,
        daily_limit: 300,
        sent_this_hour: 0,
        hourly_limit: 50,
        health_score: 100
      });

      const res = await canSendEmail(testEmail);
      expect(res.allowed).toBe(true);
    });

    it("records a successful send", async () => {
      mockPrisma.emailAccount.update.mockResolvedValueOnce({});
      await recordSuccessfulSend(testEmail);
      expect(mockPrisma.emailAccount.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { email: testEmail }
      }));
    });

    it("blocks sending with DELAYED when hourly limit is reached", async () => {
      mockPrisma.emailAccount.findUnique.mockResolvedValueOnce({
        sent_today: 10,
        daily_limit: 300,
        sent_this_hour: 50,
        hourly_limit: 50,
        health_score: 100
      });

      const res = await canSendEmail(testEmail);
      expect(res.allowed).toBe(false);
      if (!res.allowed) {
        expect(res.reason).toBe("HOURLY_LIMIT_REACHED");
      }
    });

    it("blocks sending with DELAYED when daily limit is reached", async () => {
      mockPrisma.emailAccount.findUnique.mockResolvedValueOnce({
        sent_today: 300,
        daily_limit: 300,
        sent_this_hour: 10,
        hourly_limit: 50,
        health_score: 100
      });

      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      const res = await canSendEmail(testEmail);
      expect(res.allowed).toBe(false);
      if (!res.allowed) {
        expect(res.reason).toBe("DAILY_LIMIT_REACHED");
      }
      consoleSpy.mockRestore();
    });

    it("blocks sending due to poor account health", async () => {
      mockPrisma.emailAccount.findUnique.mockResolvedValueOnce({
        sent_today: 10,
        daily_limit: 300,
        sent_this_hour: 5,
        hourly_limit: 50,
        health_score: 40
      });

      mockPrisma.systemError.findFirst.mockResolvedValueOnce(null);
      mockPrisma.systemError.create.mockResolvedValueOnce({});

      const res = await canSendEmail(testEmail);
      expect(res.allowed).toBe(false);
      if (!res.allowed) {
        expect(res.reason).toBe("POOR_ACCOUNT_HEALTH");
      }
    });
  });
});
