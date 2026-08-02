/**
 * Curated IANA Timezone List
 *
 * A focused list of ~40 timezones covering the most common regions.
 * The UI displays a human-friendly label; the stored value is the
 * canonical IANA identifier (e.g., "America/New_York").
 *
 * Grouped by region for the select dropdown.
 * All identifiers are valid IANA timezone strings.
 */

export interface TimezoneOption {
  /** Canonical IANA identifier — what gets stored in the database */
  value: string;
  /** Human-readable label for the UI */
  label: string;
  /** UTC offset label for clarity (approximate — ignores DST) */
  offset: string;
}

export interface TimezoneGroup {
  label: string;
  options: TimezoneOption[];
}

export const TIMEZONE_GROUPS: TimezoneGroup[] = [
  {
    label: "United States",
    options: [
      { value: "America/New_York",   label: "Eastern Time",   offset: "UTC−5/−4" },
      { value: "America/Chicago",    label: "Central Time",   offset: "UTC−6/−5" },
      { value: "America/Denver",     label: "Mountain Time",  offset: "UTC−7/−6" },
      { value: "America/Phoenix",    label: "Arizona (no DST)", offset: "UTC−7" },
      { value: "America/Los_Angeles",label: "Pacific Time",   offset: "UTC−8/−7" },
      { value: "America/Anchorage",  label: "Alaska Time",    offset: "UTC−9/−8" },
      { value: "Pacific/Honolulu",   label: "Hawaii Time",    offset: "UTC−10" },
    ],
  },
  {
    label: "Canada",
    options: [
      { value: "America/Toronto",    label: "Toronto (Eastern)",  offset: "UTC−5/−4" },
      { value: "America/Winnipeg",   label: "Winnipeg (Central)", offset: "UTC−6/−5" },
      { value: "America/Edmonton",   label: "Edmonton (Mountain)",offset: "UTC−7/−6" },
      { value: "America/Vancouver",  label: "Vancouver (Pacific)",offset: "UTC−8/−7" },
    ],
  },
  {
    label: "Latin America",
    options: [
      { value: "America/Mexico_City",label: "Mexico City",    offset: "UTC−6/−5" },
      { value: "America/Bogota",     label: "Bogotá",         offset: "UTC−5" },
      { value: "America/Lima",       label: "Lima",           offset: "UTC−5" },
      { value: "America/Sao_Paulo",  label: "São Paulo",      offset: "UTC−3/−2" },
      { value: "America/Argentina/Buenos_Aires", label: "Buenos Aires", offset: "UTC−3" },
    ],
  },
  {
    label: "Europe",
    options: [
      { value: "Europe/London",      label: "London (GMT/BST)",    offset: "UTC+0/+1" },
      { value: "Europe/Dublin",      label: "Dublin",              offset: "UTC+0/+1" },
      { value: "Europe/Lisbon",      label: "Lisbon",              offset: "UTC+0/+1" },
      { value: "Europe/Paris",       label: "Paris (CET)",         offset: "UTC+1/+2" },
      { value: "Europe/Berlin",      label: "Berlin (CET)",        offset: "UTC+1/+2" },
      { value: "Europe/Rome",        label: "Rome (CET)",          offset: "UTC+1/+2" },
      { value: "Europe/Madrid",      label: "Madrid (CET)",        offset: "UTC+1/+2" },
      { value: "Europe/Amsterdam",   label: "Amsterdam (CET)",     offset: "UTC+1/+2" },
      { value: "Europe/Stockholm",   label: "Stockholm (CET)",     offset: "UTC+1/+2" },
      { value: "Europe/Helsinki",    label: "Helsinki (EET)",      offset: "UTC+2/+3" },
      { value: "Europe/Athens",      label: "Athens (EET)",        offset: "UTC+2/+3" },
      { value: "Europe/Istanbul",    label: "Istanbul (TRT)",      offset: "UTC+3" },
      { value: "Europe/Moscow",      label: "Moscow (MSK)",        offset: "UTC+3" },
    ],
  },
  {
    label: "Middle East & Africa",
    options: [
      { value: "Asia/Dubai",         label: "Dubai (GST)",         offset: "UTC+4" },
      { value: "Asia/Karachi",       label: "Karachi (PKT)",       offset: "UTC+5" },
      { value: "Africa/Cairo",       label: "Cairo (EET)",         offset: "UTC+2/+3" },
      { value: "Africa/Lagos",       label: "Lagos (WAT)",         offset: "UTC+1" },
      { value: "Africa/Nairobi",     label: "Nairobi (EAT)",       offset: "UTC+3" },
    ],
  },
  {
    label: "South Asia",
    options: [
      { value: "Asia/Kolkata",       label: "India (IST)",         offset: "UTC+5:30" },
      { value: "Asia/Dhaka",         label: "Dhaka (BST)",         offset: "UTC+6" },
      { value: "Asia/Colombo",       label: "Colombo (SLST)",      offset: "UTC+5:30" },
    ],
  },
  {
    label: "Asia Pacific",
    options: [
      { value: "Asia/Bangkok",       label: "Bangkok (ICT)",       offset: "UTC+7" },
      { value: "Asia/Singapore",     label: "Singapore (SGT)",     offset: "UTC+8" },
      { value: "Asia/Shanghai",      label: "China (CST)",         offset: "UTC+8" },
      { value: "Asia/Hong_Kong",     label: "Hong Kong (HKT)",     offset: "UTC+8" },
      { value: "Asia/Tokyo",         label: "Tokyo (JST)",         offset: "UTC+9" },
      { value: "Asia/Seoul",         label: "Seoul (KST)",         offset: "UTC+9" },
      { value: "Australia/Perth",    label: "Perth (AWST)",        offset: "UTC+8" },
      { value: "Australia/Adelaide", label: "Adelaide (ACST)",     offset: "UTC+9:30" },
      { value: "Australia/Sydney",   label: "Sydney (AEST)",       offset: "UTC+10/+11" },
      { value: "Pacific/Auckland",   label: "Auckland (NZST)",     offset: "UTC+12/+13" },
    ],
  },
  {
    label: "UTC",
    options: [
      { value: "UTC",                label: "UTC (Coordinated Universal Time)", offset: "UTC+0" },
    ],
  },
];

/** Flat list of all timezone options (useful for lookup). */
export const ALL_TIMEZONES: TimezoneOption[] = TIMEZONE_GROUPS.flatMap(
  (g) => g.options
);

/**
 * Look up a timezone option by its IANA value.
 * Returns undefined if not in the curated list.
 */
export function findTimezone(value: string): TimezoneOption | undefined {
  return ALL_TIMEZONES.find((tz) => tz.value === value);
}

/**
 * Get a display string for a stored IANA timezone value.
 * Falls back to the raw value if not found in the curated list.
 */
export function getTimezoneLabel(value: string): string {
  const tz = findTimezone(value);
  return tz ? `${tz.label} (${tz.offset})` : value;
}
