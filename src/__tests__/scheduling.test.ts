/**
 * Scheduling Tests — Timezone-Aware UTC Conversion
 *
 * Tests for src/lib/scheduling.ts
 *
 * No database, no network, no side effects.
 * Verifies: localToUtc, utcToLocalDate, addDays, daysBetween, validators.
 */

import {
  localToUtc,
  utcToLocalDate,
  utcToLocalTime,
  addDays,
  daysBetween,
  isValidDateString,
  isValidTimeString,
} from "@/lib/scheduling";

// ── localToUtc ────────────────────────────────────────────────────────────────

describe("localToUtc", () => {
  // EST (UTC-5) — January, standard time
  it("converts 09:00 America/New_York (EST, UTC-5) → 14:00 UTC", () => {
    const result = localToUtc("2024-01-15", "09:00", "America/New_York");
    expect(result.toISOString()).toBe("2024-01-15T14:00:00.000Z");
  });

  // EDT (UTC-4) — July, daylight saving time
  it("converts 09:00 America/New_York (EDT, UTC-4) → 13:00 UTC", () => {
    const result = localToUtc("2024-07-15", "09:00", "America/New_York");
    expect(result.toISOString()).toBe("2024-07-15T13:00:00.000Z");
  });

  // Asia/Karachi — UTC+5, no DST
  it("converts 09:00 Asia/Karachi (UTC+5) → 04:00 UTC", () => {
    const result = localToUtc("2024-01-15", "09:00", "Asia/Karachi");
    expect(result.toISOString()).toBe("2024-01-15T04:00:00.000Z");
  });

  // Europe/London — BST (UTC+1) in July
  it("converts 09:00 Europe/London (BST, UTC+1) → 08:00 UTC in July", () => {
    const result = localToUtc("2024-07-15", "09:00", "Europe/London");
    expect(result.toISOString()).toBe("2024-07-15T08:00:00.000Z");
  });

  // Europe/London — GMT (UTC+0) in January
  it("converts 09:00 Europe/London (GMT, UTC+0) → 09:00 UTC in January", () => {
    const result = localToUtc("2024-01-15", "09:00", "Europe/London");
    expect(result.toISOString()).toBe("2024-01-15T09:00:00.000Z");
  });

  // Asia/Tokyo — JST (UTC+9), no DST
  it("converts 09:00 Asia/Tokyo (JST, UTC+9) → 00:00 UTC same day", () => {
    const result = localToUtc("2024-01-15", "09:00", "Asia/Tokyo");
    expect(result.toISOString()).toBe("2024-01-15T00:00:00.000Z");
  });

  // America/Chicago (CST, UTC-6) — January
  it("converts 09:00 America/Chicago (CST, UTC-6) → 15:00 UTC", () => {
    const result = localToUtc("2024-01-15", "09:00", "America/Chicago");
    expect(result.toISOString()).toBe("2024-01-15T15:00:00.000Z");
  });

  // UTC
  it("converts 09:00 UTC → 09:00 UTC", () => {
    const result = localToUtc("2024-01-15", "09:00", "UTC");
    expect(result.toISOString()).toBe("2024-01-15T09:00:00.000Z");
  });

  // Late night — tests day boundary
  it("converts 23:30 America/New_York (EST) → 04:30 UTC next day", () => {
    const result = localToUtc("2024-01-15", "23:30", "America/New_York");
    expect(result.toISOString()).toBe("2024-01-16T04:30:00.000Z");
  });

  // Midnight
  it("converts 00:00 America/New_York (EST) → 05:00 UTC", () => {
    const result = localToUtc("2024-01-15", "00:00", "America/New_York");
    expect(result.toISOString()).toBe("2024-01-15T05:00:00.000Z");
  });

  // DST transition — US spring-forward is March 10 2024 at 2:00 AM
  it("handles pre-DST date (March 9) correctly for America/New_York", () => {
    const result = localToUtc("2024-03-09", "12:00", "America/New_York");
    expect(result.toISOString()).toBe("2024-03-09T17:00:00.000Z"); // EST, UTC-5
  });

  it("handles post-DST date (March 11) correctly for America/New_York", () => {
    const result = localToUtc("2024-03-11", "12:00", "America/New_York");
    expect(result.toISOString()).toBe("2024-03-11T16:00:00.000Z"); // EDT, UTC-4
  });

  // India — UTC+5:30 (fractional offset)
  it("converts 09:00 Asia/Kolkata (IST, UTC+5:30) → 03:30 UTC", () => {
    const result = localToUtc("2024-01-15", "09:00", "Asia/Kolkata");
    expect(result.toISOString()).toBe("2024-01-15T03:30:00.000Z");
  });

  it("returns a Date object", () => {
    const result = localToUtc("2024-01-15", "09:00", "UTC");
    expect(result).toBeInstanceOf(Date);
  });
});

// ── utcToLocalDate ────────────────────────────────────────────────────────────

describe("utcToLocalDate", () => {
  it("converts UTC midnight to the correct local date in New_York (EST)", () => {
    const utc = new Date("2024-01-15T14:00:00.000Z");
    expect(utcToLocalDate(utc, "America/New_York")).toBe("2024-01-15");
  });

  it("detects date crossing when UTC time is early morning in UTC+9", () => {
    // 2024-01-15T00:30:00Z → Tokyo JST = 2024-01-15T09:30+09:00
    const utc = new Date("2024-01-15T00:30:00.000Z");
    expect(utcToLocalDate(utc, "Asia/Tokyo")).toBe("2024-01-15");
  });

  it("returns YYYY-MM-DD format", () => {
    const utc = new Date("2024-01-05T12:00:00.000Z");
    expect(utcToLocalDate(utc, "UTC")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// ── utcToLocalTime ────────────────────────────────────────────────────────────

describe("utcToLocalTime", () => {
  it("returns 09:00 for a 14:00 UTC in New_York (EST, UTC-5)", () => {
    const utc = new Date("2024-01-15T14:00:00.000Z");
    expect(utcToLocalTime(utc, "America/New_York")).toBe("09:00");
  });

  it("returns HH:MM format", () => {
    const utc = new Date("2024-01-15T09:00:00.000Z");
    expect(utcToLocalTime(utc, "UTC")).toMatch(/^\d{2}:\d{2}$/);
  });
});

// ── Round-trip consistency ────────────────────────────────────────────────────

describe("localToUtc + utcToLocalDate/Time round-trip", () => {
  const cases: [string, string, string][] = [
    ["2024-01-15", "09:00", "America/New_York"],
    ["2024-07-15", "14:30", "America/Los_Angeles"],
    ["2024-03-15", "11:00", "Europe/Paris"],
    ["2024-08-20", "09:00", "Asia/Karachi"],
    ["2024-01-15", "09:00", "Asia/Tokyo"],
    ["2024-06-01", "09:00", "Australia/Sydney"],
  ];

  it.each(cases)(
    "roundtrip: %s %s %s",
    (date, time, timezone) => {
      const utc = localToUtc(date, time, timezone);
      expect(utcToLocalDate(utc, timezone)).toBe(date);
      expect(utcToLocalTime(utc, timezone)).toBe(time);
    }
  );
});

// ── addDays ───────────────────────────────────────────────────────────────────

describe("addDays", () => {
  it("adds 3 days to 2024-01-15 → 2024-01-18", () => {
    expect(addDays("2024-01-15", 3)).toBe("2024-01-18");
  });

  it("handles month boundary: 2024-01-31 + 1 → 2024-02-01", () => {
    expect(addDays("2024-01-31", 1)).toBe("2024-02-01");
  });

  it("handles year boundary: 2024-12-31 + 1 → 2025-01-01", () => {
    expect(addDays("2024-12-31", 1)).toBe("2025-01-01");
  });

  it("handles leap year: 2024-02-28 + 1 → 2024-02-29", () => {
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
  });

  it("handles non-leap year: 2023-02-28 + 1 → 2023-03-01", () => {
    expect(addDays("2023-02-28", 1)).toBe("2023-03-01");
  });

  it("returns YYYY-MM-DD format", () => {
    expect(addDays("2024-01-15", 1)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("adding 0 days returns the same date", () => {
    expect(addDays("2024-06-15", 0)).toBe("2024-06-15");
  });
});

// ── daysBetween ───────────────────────────────────────────────────────────────

describe("daysBetween", () => {
  it("returns 3 for dates 3 days apart", () => {
    expect(daysBetween("2024-01-15", "2024-01-18")).toBe(3);
  });

  it("returns 1 across a month boundary", () => {
    expect(daysBetween("2024-01-31", "2024-02-01")).toBe(1);
  });

  it("returns 366 for a full leap year", () => {
    expect(daysBetween("2024-01-01", "2025-01-01")).toBe(366);
  });

  it("returns 0 for the same date", () => {
    expect(daysBetween("2024-01-15", "2024-01-15")).toBe(0);
  });
});

// ── isValidDateString ─────────────────────────────────────────────────────────

describe("isValidDateString", () => {
  it("accepts 2024-01-15", () => expect(isValidDateString("2024-01-15")).toBe(true));
  it("accepts 2024-02-29 (leap year)", () => expect(isValidDateString("2024-02-29")).toBe(true));
  it("rejects 2023-02-29 (not a leap year)", () => expect(isValidDateString("2023-02-29")).toBe(false));
  it("rejects 2024-13-01 (invalid month)", () => expect(isValidDateString("2024-13-01")).toBe(false));
  it("rejects 2024-01-32 (invalid day)", () => expect(isValidDateString("2024-01-32")).toBe(false));
  it("rejects empty string", () => expect(isValidDateString("")).toBe(false));
  it("rejects wrong format MM/DD/YYYY", () => expect(isValidDateString("01/15/2024")).toBe(false));
});

// ── isValidTimeString ─────────────────────────────────────────────────────────

describe("isValidTimeString", () => {
  it("accepts 09:00", () => expect(isValidTimeString("09:00")).toBe(true));
  it("accepts 23:59", () => expect(isValidTimeString("23:59")).toBe(true));
  it("accepts 00:00", () => expect(isValidTimeString("00:00")).toBe(true));
  it("rejects 24:00 (invalid hour)", () => expect(isValidTimeString("24:00")).toBe(false));
  it("rejects 09:60 (invalid minutes)", () => expect(isValidTimeString("09:60")).toBe(false));
  it("rejects empty string", () => expect(isValidTimeString("")).toBe(false));
  it("rejects 9:00 (missing leading zero)", () => expect(isValidTimeString("9:00")).toBe(false));
  it("rejects 9am format", () => expect(isValidTimeString("9am")).toBe(false));
});
