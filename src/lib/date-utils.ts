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

/**
 * Converts a local date string (YYYY-MM-DD) and local time string (HH:MM) in a given IANA timezone into an exact UTC Date.
 */
export function localDateTimeToUtc(dateStr: string, timeStr: string = "09:00", timezone: string = "UTC"): Date {
  try {
    const [year, month, day] = dateStr.split("-").map(Number);
    const [hours, minutes] = timeStr.split(":").map(Number);
    const naiveUtc = Date.UTC(year, month - 1, day, hours || 0, minutes || 0, 0, 0);

    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone || "UTC",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      hourCycle: "h23",
    }).formatToParts(new Date(naiveUtc));

    const pYear = Number(parts.find((p) => p.type === "year")?.value);
    const pMonth = Number(parts.find((p) => p.type === "month")?.value);
    const pDay = Number(parts.find((p) => p.type === "day")?.value);
    const pHour = Number(parts.find((p) => p.type === "hour")?.value);
    const pMinute = Number(parts.find((p) => p.type === "minute")?.value);
    const pSecond = Number(parts.find((p) => p.type === "second")?.value);

    const targetAsUtc = Date.UTC(pYear, pMonth - 1, pDay, pHour, pMinute, pSecond || 0, 0);
    const diffMs = targetAsUtc - naiveUtc;

    return new Date(naiveUtc - diffMs);
  } catch {
    return new Date(`${dateStr}T${timeStr.length === 5 ? timeStr + ":00" : timeStr}Z`);
  }
}

/**
 * Formats a UTC ISO string into a local date and time in a given IANA timezone.
 * Returns date (YYYY-MM-DD), time (hh:mm AM/PM), and offset label (e.g. "PKT", "EDT").
 */
export function formatInTimezone(
  utcIso: string,
  timezone: string = "UTC"
): { date: string; time: string; offset: string; tzAbbr: string } {
  try {
    const d = new Date(utcIso);
    if (isNaN(d.getTime())) throw new Error("invalid");

    const dateStr = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      month: "short",
      day: "numeric",
    }).format(d);

    const timeStr = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(d);

    const tzAbbr = getTimezoneShortLabel(timezone, d);

    // Use Intl to get the real offset in the target timezone
    const offsetParts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: "shortOffset",
    }).formatToParts(d);
    const offsetLabel = offsetParts.find((p) => p.type === "timeZoneName")?.value ?? "UTC";

    return { date: dateStr, time: timeStr, offset: offsetLabel, tzAbbr };
  } catch {
    return { date: "—", time: "—", offset: "UTC", tzAbbr: "UTC" };
  }
}

const TIMEZONE_ABBR_MAP: Record<string, string> = {
  "Asia/Karachi": "PKT",
  "Asia/Kolkata": "IST",
  "Asia/Dubai": "GST",
  "Asia/Singapore": "SGT",
  "Asia/Tokyo": "JST",
  "UTC": "UTC",
};

/**
 * Returns a short human-readable timezone abbreviation (e.g. "PKT", "EDT", "GMT").
 * Uses clean 3-letter code mapping or localized abbreviation.
 */
export function getTimezoneShortLabel(timezone: string, at: Date = new Date()): string {
  try {
    if (TIMEZONE_ABBR_MAP[timezone]) {
      return TIMEZONE_ABBR_MAP[timezone];
    }
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: "short",
    }).formatToParts(at);
    const val = parts.find((p) => p.type === "timeZoneName")?.value ?? "TZ";
    // Replace GMT+5 / GMT+05:00 with clean label if available
    if (timezone.includes("Karachi")) return "PKT";
    return val;
  } catch {
    return "TZ";
  }
}


/**
 * Returns a human-friendly city or region name for a timezone identifier.
 * Example: 'Europe/London' -> 'London', 'America/New_York' -> 'New York', 'Asia/Karachi' -> 'Pakistan'
 */
export function getTimezoneFriendlyCity(timezone: string): string {
  const cityMap: Record<string, string> = {
    "America/New_York": "New York",
    "America/Chicago": "Chicago",
    "America/Denver": "Denver",
    "America/Los_Angeles": "Los Angeles",
    "Europe/London": "London",
    "Europe/Paris": "Paris / Rome",
    "Asia/Dubai": "Dubai",
    "Asia/Karachi": "Pakistan",
    "Asia/Kolkata": "India",
    "Asia/Singapore": "Singapore",
    "Asia/Tokyo": "Tokyo",
    "Australia/Sydney": "Sydney",
    "UTC": "UTC",
  };
  if (cityMap[timezone]) return cityMap[timezone];
  const parts = timezone.split("/");
  const city = parts[parts.length - 1]?.replace(/_/g, " ");
  return city || timezone;
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

/**
 * Converts a local date string (YYYY-MM-DD) and time string (HH:MM or HH:MM:SS or "10:51 AM")
 * in a given IANA timezone (e.g. "Asia/Karachi", "America/New_York") into the exact UTC Date.
 */
export function toUtcFromZonedTime(dateStr: string, timeStr: string = "09:00", timezone: string = "UTC"): Date {
  try {
    const cleanTime = timeStr.trim();
    let hours = 9, minutes = 0, seconds = 0;
    
    // Support "10:51 AM", "10:51", "10:51:00", etc.
    const ampmMatch = cleanTime.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i);
    if (ampmMatch) {
      hours = parseInt(ampmMatch[1], 10);
      minutes = parseInt(ampmMatch[2], 10);
      seconds = ampmMatch[3] ? parseInt(ampmMatch[3], 10) : 0;
      const ampm = ampmMatch[4]?.toUpperCase();
      if (ampm === "PM" && hours < 12) hours += 12;
      if (ampm === "AM" && hours === 12) hours = 0;
    }

    const [y, m, d] = dateStr.split("-").map(Number);
    const utcTimestamp = Date.UTC(y, m - 1, d, hours, minutes, seconds, 0);

    // Measure timezone offset at this timestamp
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
  } catch {
    return new Date(`${dateStr}T${timeStr}:00Z`);
  }
}

/**
 * Converts a fixed time in a lead's timezone to what the user's local clock shows.
 * Used by the wizard smart preview tip to show: "9:00 AM NY = 6:00 PM on your clock"
 *
 * @param leadTime  - "HH:MM" string (e.g. "09:00")
 * @param leadTz    - IANA timezone of the lead (e.g. "America/New_York")
 * @param userTz    - IANA timezone of the user (e.g. "Asia/Karachi")
 * @returns         - Formatted local time string (e.g. "06:00 PM")
 */
export function convertLeadTimeToUserLocal(
  leadTime: string = "09:00",
  leadTz: string = "UTC",
  userTz: string = "UTC"
): string {
  try {
    // Use today's date as a reference anchor — we only care about the time conversion
    const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "UTC" }).format(new Date());
    // Convert the lead's scheduled time to UTC
    const utcDate = localDateTimeToUtc(todayStr, leadTime, leadTz);
    // Format the UTC date in the user's timezone
    return new Intl.DateTimeFormat("en-US", {
      timeZone: userTz,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(utcDate);
  } catch {
    return leadTime;
  }
}

/**
 * Checks whether a given UTC moment falls within business hours (8 AM – 6 PM, Mon–Fri)
 * in the lead's local timezone. Used by the business hours guard in the import pipeline.
 *
 * @param utcDate  - The UTC Date object to test
 * @param leadTz   - IANA timezone of the lead (e.g. "America/New_York")
 * @returns        - true if within business hours, false otherwise
 */
export function isInLeadBusinessHours(utcDate: Date, leadTz: string = "UTC"): boolean {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: leadTz,
      hour: "numeric",
      weekday: "short",
      hourCycle: "h23",
    }).formatToParts(utcDate);

    const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 9);
    const weekday = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
    const isWeekday = !["Sat", "Sun"].includes(weekday);
    const inWorkHours = hour >= 8 && hour < 18;
    return isWeekday && inWorkHours;
  } catch {
    return true;
  }
}

/**
 * Advances a UTC date to the next business-day 9:00 AM in the lead's timezone.
 * Skips weekends. Used when a scheduled send time falls outside business hours.
 *
 * @param utcDate  - The current/proposed UTC send time
 * @param leadTz   - IANA timezone of the lead
 * @returns        - New UTC Date that corresponds to next business 9:00 AM in leadTz
 */
export function nextBusinessSlotUtc(utcDate: Date, leadTz: string = "UTC"): Date {
  try {
    // Walk forward in 1-day increments until we find a Monday–Friday slot
    let candidate = new Date(utcDate);

    for (let i = 0; i < 7; i++) {
      const localDateStr = new Intl.DateTimeFormat("en-CA", {
        timeZone: leadTz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(candidate);

      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: leadTz,
        weekday: "short",
      }).formatToParts(candidate);

      const weekday = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
      if (!["Sat", "Sun"].includes(weekday)) {
        // Schedule at 9:00 AM in the lead's timezone on this date
        return localDateTimeToUtc(localDateStr, "09:00", leadTz);
      }

      // Advance one day
      candidate = new Date(candidate.getTime() + 24 * 60 * 60 * 1000);
    }

    // Fallback: just return original date unchanged
    return utcDate;
  } catch {
    return utcDate;
  }
}

