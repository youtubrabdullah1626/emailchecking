/**
 * Scheduling Utilities — Timezone-Aware UTC Conversion
 *
 * No external dependencies. Uses the platform Intl API (works in both
 * Node.js 18+ and all modern browsers).
 *
 * Core contract:
 *   localToUtc("2024-01-15", "09:00", "America/New_York")
 *   → 2024-01-15T14:00:00.000Z  (EST = UTC-5)
 *
 *   localToUtc("2024-07-15", "09:00", "America/New_York")
 *   → 2024-07-15T13:00:00.000Z  (EDT = UTC-4)   ← DST handled correctly
 */

// ── Local → UTC ───────────────────────────────────────────────────────────────

/**
 * Convert a local date string + time string in a given IANA timezone
 * to an exact UTC Date object.
 *
 * Algorithm:
 *  1. Create a "pseudo-UTC" Date treating the local time as if it were UTC.
 *  2. Format that pseudo-UTC in the target timezone → see what local time it shows.
 *  3. Compute the offset between the pseudo-UTC and the displayed local time.
 *  4. Subtract that offset from pseudo-UTC → true UTC.
 *
 * This correctly handles DST transitions for non-ambiguous wall-clock times.
 */
export function localToUtc(
  dateStr: string,
  timeStr: string,
  timezone: string
): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hours, minutes] = timeStr.split(":").map(Number);

  // Step 1: pseudo-UTC — treat local inputs as UTC
  const pseudoUtc = new Date(
    Date.UTC(year, month - 1, day, hours, minutes, 0, 0)
  );

  // Step 2: format pseudo-UTC in the target timezone
  const parts = getFormattedParts(pseudoUtc, timezone);

  // Step 3: compute the UTC value of what the target timezone displays
  const tzMs = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );
  const offsetMs = tzMs - pseudoUtc.getTime();

  // Step 4: subtract offset to get the real UTC
  return new Date(pseudoUtc.getTime() - offsetMs);
}

// ── UTC → Local ───────────────────────────────────────────────────────────────

/**
 * Convert a UTC Date to a local date string "YYYY-MM-DD" in the given timezone.
 * Uses en-CA locale which formats as YYYY-MM-DD natively.
 */
export function utcToLocalDate(utcDate: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(utcDate);
}

/**
 * Convert a UTC Date to a local time string "HH:MM" in the given timezone.
 */
export function utcToLocalTime(utcDate: Date, timezone: string): string {
  const parts = getFormattedParts(utcDate, timezone);
  const hh = String(parts.hour).padStart(2, "0");
  const mm = String(parts.minute).padStart(2, "0");
  return `${hh}:${mm}`;
}

/**
 * Format a UTC Date as "YYYY-MM-DD HH:MM (TZ)" in the given timezone.
 * Used for display in previews.
 */
export function formatLocalDisplay(utcDate: Date, timezone: string): string {
  const date = utcToLocalDate(utcDate, timezone);
  const time = utcToLocalTime(utcDate, timezone);
  return `${date} at ${time}`;
}

// ── Date arithmetic ───────────────────────────────────────────────────────────

/**
 * Add N calendar days to a "YYYY-MM-DD" date string.
 * Uses noon UTC to avoid DST boundary issues when adding days.
 */
export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0));
  date.setUTCDate(date.getUTCDate() + days);
  return isoDateOnly(date);
}

/**
 * Compute the number of calendar days between two "YYYY-MM-DD" date strings.
 * Returns a positive number when date2 > date1.
 */
export function daysBetween(date1Str: string, date2Str: string): number {
  const [y1, m1, d1] = date1Str.split("-").map(Number);
  const [y2, m2, d2] = date2Str.split("-").map(Number);
  const a = Date.UTC(y1, m1 - 1, d1, 12, 0, 0);
  const b = Date.UTC(y2, m2 - 1, d2, 12, 0, 0);
  return Math.round((b - a) / 86_400_000);
}

// ── Validation helpers ────────────────────────────────────────────────────────

/**
 * Return true if the string is a valid YYYY-MM-DD date.
 */
export function isValidDateString(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const [year, month, day] = dateStr.split("-").map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const d = new Date(Date.UTC(year, month - 1, day));
  return (
    d.getUTCFullYear() === year &&
    d.getUTCMonth() === month - 1 &&
    d.getUTCDate() === day
  );
}

/**
 * Return true if the string is a valid HH:MM 24-hour time.
 */
export function isValidTimeString(timeStr: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(timeStr)) return false;
  const [h, m] = timeStr.split(":").map(Number);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

interface DateTimeParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function getFormattedParts(date: Date, timezone: string): DateTimeParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts: Record<string, number> = {};
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== "literal") {
      parts[part.type] = Number(part.value);
    }
  }

  // Normalize hour 24 → 0 (some ICU implementations return 24 for midnight)
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour === 24 ? 0 : parts.hour,
    minute: parts.minute,
    second: parts.second ?? 0,
  };
}

function isoDateOnly(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
