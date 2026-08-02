import { WarmupSettings } from "./WarmupService";

export interface RampState {
  status: "ACTIVE" | "PAUSED" | "COMPLETED" | "NOT_STARTED";
  currentDay: number;
  dailyTarget: number;
  progressPercent: number;
  remainingDays: number;
}

/**
 * Normalizes a Date object to UTC midnight to avoid timezone-induced boundary errors.
 */
function normalizeDate(d: Date | string): Date {
  const date = new Date(d);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/**
 * Calculates the number of elapsed days between two normalized dates.
 * If businessDaysOnly is true, skips Saturdays (6) and Sundays (0).
 */
function calculateElapsedDays(start: Date, current: Date, businessDaysOnly: boolean): number {
  if (current < start) return -1; // Not started yet

  let elapsed = 0;
  const runner = new Date(start.getTime());

  while (runner < current) {
    if (!businessDaysOnly || (runner.getUTCDay() !== 0 && runner.getUTCDay() !== 6)) {
      elapsed++;
    }
    runner.setUTCDate(runner.getUTCDate() + 1);
  }

  // Also verify if current date itself is valid when doing business days check 
  // for the "Current Day" perspective. But the loop gives the absolute distance in valid days.
  return elapsed;
}

/**
 * The core Gradual Ramp Engine.
 * Pure deterministic calculations based solely on configuration and time bounds.
 */
export function calculateRampState(
  startDateStr: string,
  currentDate: Date,
  settings: WarmupSettings
): RampState {
  if (!settings.enabled) {
    return {
      status: "PAUSED",
      currentDay: 0,
      dailyTarget: 0,
      progressPercent: 0,
      remainingDays: 0,
    };
  }

  const start = normalizeDate(startDateStr);
  const current = normalizeDate(currentDate);

  const elapsedValidDays = calculateElapsedDays(start, current, settings.businessDaysOnly);

  if (elapsedValidDays < 0) {
    return {
      status: "NOT_STARTED",
      currentDay: 0,
      dailyTarget: 0,
      progressPercent: 0,
      remainingDays: settings.warmupDurationDays,
    };
  }

  const currentDay = elapsedValidDays + 1; // Day 1 is the start day
  const { startingDailyEmails, maxDailyEmails, warmupDurationDays } = settings;

  // Handle immediate max state cases (Duration = 1, min = max, or already exceeded max)
  if (warmupDurationDays <= 1 || startingDailyEmails >= maxDailyEmails || currentDay >= warmupDurationDays) {
    return {
      status: "COMPLETED",
      currentDay: Math.min(currentDay, warmupDurationDays), // Clamp visualization to max
      dailyTarget: maxDailyEmails,
      progressPercent: 100,
      remainingDays: 0,
    };
  }

  // Linear Interpolation: Target = Start + (Day - 1) * ((Max - Start) / (Duration - 1))
  let target = startingDailyEmails + (currentDay - 1) * ((maxDailyEmails - startingDailyEmails) / (warmupDurationDays - 1));
  target = Math.round(target);
  
  // Strict Clamping
  target = Math.max(startingDailyEmails, Math.min(maxDailyEmails, target));

  // Determine Completion
  const isCompleted = target >= maxDailyEmails;
  const finalStatus = isCompleted ? "COMPLETED" : "ACTIVE";
  
  // Calculate Progress (min 0, max 100)
  const progressPercent = Math.min(100, Math.round((currentDay / warmupDurationDays) * 100));
  
  // Calculate Remaining Days
  const remainingDays = Math.max(0, warmupDurationDays - currentDay);

  return {
    status: finalStatus,
    currentDay,
    dailyTarget: target,
    progressPercent: isCompleted ? 100 : progressPercent,
    remainingDays,
  };
}
