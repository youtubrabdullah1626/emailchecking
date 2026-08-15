import { calculateRampUpLimit } from "@/lib/reputation/guard";

describe("10x Smart Inbox Rotation & Warmup Engine", () => {
  describe("Automated Ramp-Up Mathematical Correctness", () => {
    const referenceDate = new Date("2026-08-15T12:00:00Z");

    it("enforces Day 1-3 ramp limit (max 10/day) for new inboxes (0-2 days old)", () => {
      // 1 day old
      const day1 = new Date("2026-08-14T12:00:00Z");
      const limit1 = calculateRampUpLimit(day1, 50, "ACTIVE", referenceDate);
      expect(limit1).toBe(10);

      // 0 days old (created today)
      const day0 = new Date("2026-08-15T08:00:00Z");
      const limit0 = calculateRampUpLimit(day0, 50, "ACTIVE", referenceDate);
      expect(limit0).toBe(10);

      // 2 days old
      const day2 = new Date("2026-08-13T12:00:00Z");
      const limit2 = calculateRampUpLimit(day2, 50, "ACTIVE", referenceDate);
      expect(limit2).toBe(10);
    });

    it("enforces Day 4-7 ramp limit (max 25/day) for maturing inboxes (3-6 days old)", () => {
      // 4 days old
      const day4 = new Date("2026-08-11T12:00:00Z");
      const limit4 = calculateRampUpLimit(day4, 50, "ACTIVE", referenceDate);
      expect(limit4).toBe(25);

      // 6 days old
      const day6 = new Date("2026-08-09T12:00:00Z");
      const limit6 = calculateRampUpLimit(day6, 50, "ACTIVE", referenceDate);
      expect(limit6).toBe(25);
    });

    it("unlocks Full Daily Capacity on Day 8+ (7+ days old)", () => {
      // 10 days old
      const day10 = new Date("2026-08-05T12:00:00Z");
      const limit10 = calculateRampUpLimit(day10, 50, "ACTIVE", referenceDate);
      expect(limit10).toBe(50);

      // Custom base limit (e.g. 100)
      const limitCustom = calculateRampUpLimit(day10, 100, "ACTIVE", referenceDate);
      expect(limitCustom).toBe(100);
    });

    it("bypasses ramp-up if warmup_status is COMPLETED or SKIPPED", () => {
      // Brand new account (created today) with warmup COMPLETED
      const createdToday = new Date("2026-08-15T08:00:00Z");
      const limitCompleted = calculateRampUpLimit(createdToday, 50, "COMPLETED", referenceDate);
      expect(limitCompleted).toBe(50);

      const limitSkipped = calculateRampUpLimit(createdToday, 75, "SKIPPED", referenceDate);
      expect(limitSkipped).toBe(75);
    });

    it("gracefully falls back to baseLimit if createdAt is missing", () => {
      const limitNull = calculateRampUpLimit(null, 50, "ACTIVE", referenceDate);
      expect(limitNull).toBe(50);

      const limitUndefined = calculateRampUpLimit(undefined, 50, "ACTIVE", referenceDate);
      expect(limitUndefined).toBe(50);
    });
  });
});
