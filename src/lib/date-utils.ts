/**
 * Enterprise Date & Timezone Utilities
 * 
 * Provides mathematically precise timezone-aware calculations for:
 * - Top-of-the-Hour Hourly Velocity Resets (:00:00.000)
 * - Exact Local Midnight Daily Resets (00:00:00.000 in target IANA timezone)
 * - 7-Day Timezone Update Cooldown Enforcement
 */

export const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Returns the exact start of the current hour in UTC (:00:00.000)
 */
export function getStartOfHour(now: Date = new Date()): Date {
  const date = new Date(now);
  date.setMinutes(0, 0, 0);
  return date;
}

/**
 * Returns the exact UTC Date corresponding to 00:00:00.000 (Midnight)
 * on the current day in the specified IANA timezone.
 */
export function getStartOfDayInTimezone(timezone: string = "UTC", now: Date = new Date()): Date {
  try {
    // 1. Get the local YYYY-MM-DD in the target timezone
    const localDateStr = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);

    const [y, m, d] = localDateStr.split("-").map(Number);
    const utcTimestamp = Date.UTC(y, m - 1, d, 0, 0, 0, 0);

    // 2. Format that timestamp in the target timezone to measure the exact shift
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      hourCycle: "h23",
    }).formatToParts(new Date(utcTimestamp));

    const pYear = Number(parts.find((p) => p.type === "year")?.value);
    const pMonth = Number(parts.find((p) => p.type === "month")?.value);
    const pDay = Number(parts.find((p) => p.type === "day")?.value);
    const pHour = Number(parts.find((p) => p.type === "hour")?.value);
    const pMinute = Number(parts.find((p) => p.type === "minute")?.value);
    const pSecond = Number(parts.find((p) => p.type === "second")?.value);

    const targetAsUtc = Date.UTC(pYear, pMonth - 1, pDay, pHour, pMinute, pSecond, 0);
    const diffMs = targetAsUtc - utcTimestamp;

    return new Date(utcTimestamp - diffMs);
  } catch (err) {
    // Fallback to UTC midnight if timezone is invalid
    const fallback = new Date(now);
    fallback.setUTCHours(0, 0, 0, 0);
    return fallback;
  }
}

export interface CooldownStatus {
  canChange: boolean;
  remainingDays: number;
  remainingMs: number;
  nextAllowedDate: Date | null;
}

/**
 * Validates whether a user is allowed to change their timezone based on the 7-day cooldown.
 */
export function checkTimezoneCooldown(lastUpdatedAt: Date | string | null): CooldownStatus {
  if (!lastUpdatedAt) {
    return {
      canChange: true,
      remainingDays: 0,
      remainingMs: 0,
      nextAllowedDate: null,
    };
  }

  const lastUpdate = new Date(lastUpdatedAt).getTime();
  const now = Date.now();
  const elapsed = now - lastUpdate;

  if (elapsed >= SEVEN_DAYS_MS) {
    return {
      canChange: true,
      remainingDays: 0,
      remainingMs: 0,
      nextAllowedDate: null,
    };
  }

  const remainingMs = SEVEN_DAYS_MS - elapsed;
  const remainingDays = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
  const nextAllowedDate = new Date(lastUpdate + SEVEN_DAYS_MS);

  return {
    canChange: false,
    remainingDays,
    remainingMs,
    nextAllowedDate,
  };
}
