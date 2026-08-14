import {
  getStartOfHour,
  getStartOfDayInTimezone,
  checkTimezoneCooldown,
  SEVEN_DAYS_MS,
} from "@/lib/date-utils";
import { ALL_TIMEZONES, findTimezone } from "@/lib/timezones";

describe("Timezone & Platform Capacity Reset Logic", () => {
  describe("getStartOfHour", () => {
    it("should snap precisely to the top of the hour :00:00.000", () => {
      const testDate = new Date("2026-08-14T14:37:45.892Z");
      const startOfHour = getStartOfHour(testDate);

      expect(startOfHour.toISOString()).toBe("2026-08-14T14:00:00.000Z");
      expect(startOfHour.getMinutes()).toBe(0);
      expect(startOfHour.getSeconds()).toBe(0);
      expect(startOfHour.getMilliseconds()).toBe(0);
    });
  });

  describe("getStartOfDayInTimezone", () => {
    it("should correctly compute midnight in UTC", () => {
      const testDate = new Date("2026-08-14T14:37:45.000Z");
      const midnightUtc = getStartOfDayInTimezone("UTC", testDate);

      expect(midnightUtc.toISOString()).toBe("2026-08-14T00:00:00.000Z");
    });

    it("should correctly compute midnight in Asia/Karachi (UTC+5)", () => {
      // In Karachi (UTC+5), at 2026-08-14 14:00 UTC, it is 2026-08-14 19:00 (7 PM).
      // Midnight in Karachi was at 2026-08-13 19:00:00 UTC.
      const testDate = new Date("2026-08-14T14:00:00.000Z");
      const midnightKarachi = getStartOfDayInTimezone("Asia/Karachi", testDate);

      expect(midnightKarachi.toISOString()).toBe("2026-08-13T19:00:00.000Z");
    });

    it("should correctly compute midnight in America/New_York (EDT = UTC-4 in August)", () => {
      // In New York (EDT, UTC-4), at 2026-08-14 14:00 UTC, it is 2026-08-14 10:00 AM.
      // Midnight in New York was at 2026-08-14 04:00:00 UTC.
      const testDate = new Date("2026-08-14T14:00:00.000Z");
      const midnightNY = getStartOfDayInTimezone("America/New_York", testDate);

      expect(midnightNY.toISOString()).toBe("2026-08-14T04:00:00.000Z");
    });
  });

  describe("checkTimezoneCooldown (7-Day Rule)", () => {
    it("should allow change if never updated before", () => {
      const status = checkTimezoneCooldown(null);
      expect(status.canChange).toBe(true);
      expect(status.remainingDays).toBe(0);
    });

    it("should block change if updated 2 days ago", () => {
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      const status = checkTimezoneCooldown(twoDaysAgo);

      expect(status.canChange).toBe(false);
      expect(status.remainingDays).toBe(5);
      expect(status.nextAllowedDate).toBeDefined();
    });

    it("should allow change if updated 8 days ago", () => {
      const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
      const status = checkTimezoneCooldown(eightDaysAgo);

      expect(status.canChange).toBe(true);
      expect(status.remainingDays).toBe(0);
    });
  });

  describe("Timezone String Validation & Curated Lookups", () => {
    it("should find valid curated timezone identifiers", () => {
      expect(findTimezone("Asia/Karachi")).toBeDefined();
      expect(findTimezone("America/New_York")).toBeDefined();
      expect(findTimezone("Europe/London")).toBeDefined();
    });

    it("should return undefined for invalid or spoofed strings", () => {
      expect(findTimezone("INVALID_MALICIOUS_STRING")).toBeUndefined();
      expect(findTimezone("Hack/Timezone")).toBeUndefined();
    });

    it("should support case-insensitive normalization", () => {
      const match = ALL_TIMEZONES.find((t) => t.value.toLowerCase() === "asia/karachi".toLowerCase());
      expect(match?.value).toBe("Asia/Karachi");
    });
  });
});
