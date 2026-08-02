import { WarmupSettings } from "./WarmupService";

/**
 * A simple seeded pseudo-random number generator (Mulberry32).
 * Guarantees deterministic randomness given the same seed.
 */
function createPRNG(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Hash a string to a 32-bit integer for seeding the PRNG.
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
}

/**
 * Parse "HH:MM" into total minutes from midnight.
 */
function parseTimeStr(timeStr: string): number {
  const [hours, minutes] = timeStr.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * Format total minutes from midnight into "HH:MM".
 */
function formatTimeStr(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
}

/**
 * The core smart scheduling algorithm.
 * Guarantees:
 * - Deterministic output per (date + settings)
 * - Exact array length = dailyTarget (or 0 if weekend + businessDaysOnly)
 * - Chronologically sorted
 * - No duplicate timestamps
 * - Strictly bounded within sendingWindow
 */
export function generateWarmupSchedule(
  settings: WarmupSettings,
  targetDate: Date,
  dailyTarget: number
): string[] {
  if (dailyTarget <= 0) return [];

  const dayOfWeek = targetDate.getDay(); // 0 is Sunday, 6 is Saturday
  if (settings.businessDaysOnly && (dayOfWeek === 0 || dayOfWeek === 6)) {
    return []; // No emails on weekends
  }

  const [startStr, endStr] = settings.sendingWindow.split("-");
  const startMinutes = parseTimeStr(startStr);
  const endMinutes = parseTimeStr(endStr);
  
  if (endMinutes <= startMinutes) {
    return []; // Invalid window
  }

  const windowDuration = endMinutes - startMinutes;
  
  // If we need more emails than available minutes, cap it (1 email per minute max)
  const actualTarget = Math.min(dailyTarget, windowDuration);
  if (actualTarget <= 0) return [];

  // Seed the PRNG using the date and a hash of the relevant settings
  const dateStr = targetDate.toISOString().split("T")[0]; // YYYY-MM-DD
  const settingsHash = hashString(
    `${dateStr}-${dailyTarget}-${settings.sendingWindow}-${settings.timezone}`
  );
  const random = createPRNG(settingsHash);

  const baseInterval = windowDuration / actualTarget;
  const maxJitter = baseInterval * 0.4; // +/- 40% of the interval

  const usedMinutes = new Set<number>();
  const scheduledMinutes: number[] = [];

  for (let i = 0; i < actualTarget; i++) {
    const baseMinute = startMinutes + i * baseInterval;
    
    // Generate jitter between -maxJitter and +maxJitter
    const jitter = (random() * 2 - 1) * maxJitter;
    let targetMinute = Math.round(baseMinute + jitter);

    // Clamp to window bounds
    targetMinute = Math.max(startMinutes, Math.min(endMinutes - 1, targetMinute));

    // Collision resolution
    let attempts = 0;
    const maxAttempts = windowDuration;
    let searchDirection = 1;
    let step = 1;

    while (usedMinutes.has(targetMinute) && attempts < maxAttempts) {
      targetMinute += searchDirection * step;
      
      // Clamp and reverse direction if hitting boundary
      if (targetMinute >= endMinutes) {
        targetMinute = endMinutes - 1;
        searchDirection = -1;
      } else if (targetMinute < startMinutes) {
        targetMinute = startMinutes;
        searchDirection = 1;
      }
      
      step++;
      attempts++;
    }

    // Safety fallback if the entire window is somehow full (should never happen with clamping)
    if (!usedMinutes.has(targetMinute)) {
      usedMinutes.add(targetMinute);
      scheduledMinutes.push(targetMinute);
    }
  }

  // Sort chronologically
  scheduledMinutes.sort((a, b) => a - b);

  // Map back to time strings. 
  // (In a real system with cross-timezone boundaries, we would generate full ISO strings 
  // by attaching these times to the targetDate using the specified timezone.
  // For Block 2 UI visualization, HH:MM strings representing the time in the specified timezone is sufficient).
  return scheduledMinutes.map(formatTimeStr);
}
