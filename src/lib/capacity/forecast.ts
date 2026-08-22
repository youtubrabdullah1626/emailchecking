/**
 * Pure Mathematical Capacity Forecasting & Queue Engine — SILAER 10X
 * 
 * Provides deterministic client & server calculation utilities for:
 * - Dynamic capacity exhaustion evaluation
 * - Timezone-aware midnight & hourly reset windows
 * - Exact ordinal queue positioning
 * - Human-readable estimated dispatch timing
 */

export interface CapacityStateEvaluation {
  isDailyCapReached: boolean;
  isHourlyPacingActive: boolean;
  dailyHeadroom: number;
  hourlyHeadroom: number;
  utilizationPercent: number;
  nextWindowUtc: Date;
  nextWindowLabel: string;
  reason: "READY" | "DAILY_CAP_REACHED" | "HOURLY_PACING_ACTIVE" | "NO_CONNECTED_INBOXES";
}

/**
 * Evaluates real-time capacity and headroom across daily and hourly limits.
 */
export function evaluateCapacityState(
  sentToday: number,
  dailyLimit: number,
  sentThisHour: number = 0,
  hourlyLimit: number = 15,
  connectedInboxesCount: number = 1,
  userTimezone: string = "UTC"
): CapacityStateEvaluation {
  if (connectedInboxesCount <= 0) {
    const nextWindowUtc = getNextDailyResetWindow(userTimezone);
    return {
      isDailyCapReached: true,
      isHourlyPacingActive: false,
      dailyHeadroom: 0,
      hourlyHeadroom: 0,
      utilizationPercent: 100,
      nextWindowUtc,
      nextWindowLabel: "No active connected inboxes available",
      reason: "NO_CONNECTED_INBOXES",
    };
  }

  const effectiveDailyLimit = Math.max(1, dailyLimit);
  const effectiveHourlyLimit = Math.max(1, hourlyLimit);

  const dailyHeadroom = Math.max(0, effectiveDailyLimit - sentToday);
  const hourlyHeadroom = Math.max(0, effectiveHourlyLimit - sentThisHour);

  const isDailyCapReached = sentToday >= effectiveDailyLimit;
  const isHourlyPacingActive = !isDailyCapReached && sentThisHour >= effectiveHourlyLimit;

  let nextWindowUtc: Date;
  let nextWindowLabel: string;

  if (isDailyCapReached) {
    nextWindowUtc = getNextDailyResetWindow(userTimezone);
    nextWindowLabel = `Daily limit reached (${sentToday}/${effectiveDailyLimit}). Resumes at midnight (${userTimezone.split("/").pop() || "UTC"}).`;
  } else if (isHourlyPacingActive) {
    nextWindowUtc = getNextHourlyResetWindow();
    nextWindowLabel = `Hourly governor pacing (${sentThisHour}/${effectiveHourlyLimit}). Resumes at top of the hour.`;
  } else {
    nextWindowUtc = new Date();
    nextWindowLabel = `Capacity available: ${dailyHeadroom} sends remaining today.`;
  }

  const utilizationPercent = Math.min(100, Math.round((sentToday / effectiveDailyLimit) * 100));

  return {
    isDailyCapReached,
    isHourlyPacingActive,
    dailyHeadroom,
    hourlyHeadroom,
    utilizationPercent,
    nextWindowUtc,
    nextWindowLabel,
    reason: isDailyCapReached
      ? "DAILY_CAP_REACHED"
      : isHourlyPacingActive
      ? "HOURLY_PACING_ACTIVE"
      : "READY",
  };
}

/**
 * Calculates the exact upcoming midnight timestamp for the specified timezone.
 */
export function getNextDailyResetWindow(userTimezone: string = "UTC"): Date {
  const now = new Date();
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: userTimezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const getPart = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";

    const hour = parseInt(getPart("hour"), 10);
    const minute = parseInt(getPart("minute"), 10);
    const second = parseInt(getPart("second"), 10);

    const msSinceLocalMidnight = (hour * 3600 + minute * 60 + second) * 1000;
    const msUntilLocalMidnight = 24 * 3600 * 1000 - msSinceLocalMidnight;

    return new Date(now.getTime() + Math.max(1000, msUntilLocalMidnight));
  } catch {
    // Fallback: UTC midnight
    const utcMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0));
    return utcMidnight;
  }
}

/**
 * Calculates the upcoming top-of-the-hour timestamp (:00:00.000).
 */
export function getNextHourlyResetWindow(): Date {
  const now = new Date();
  const nextHour = new Date(now);
  nextHour.setMinutes(60, 0, 0);
  return nextHour;
}

/**
 * Computes the 1-indexed queue position of a specific step in a list of candidate steps.
 */
export function computeQueuePosition<T extends { id?: string; scheduled_at_utc?: string | Date }>(
  stepId: string,
  candidateSteps: T[]
): { position: number; totalQueued: number } {
  if (!candidateSteps || candidateSteps.length === 0) {
    return { position: 1, totalQueued: 1 };
  }

  const sorted = [...candidateSteps].sort((a, b) => {
    const timeA = a.scheduled_at_utc ? new Date(a.scheduled_at_utc).getTime() : 0;
    const timeB = b.scheduled_at_utc ? new Date(b.scheduled_at_utc).getTime() : 0;
    return timeA - timeB;
  });

  const index = sorted.findIndex((s) => s.id === stepId);
  const position = index >= 0 ? index + 1 : 1;

  return {
    position,
    totalQueued: sorted.length,
  };
}

/**
 * Estimates human-readable dispatch time based on queue position and reset windows.
 */
export function estimateStepDispatchTime(
  queuePosition: number,
  nextWindowUtc: Date,
  hourlyLimit: number = 15
): string {
  const effectiveHourly = Math.max(1, hourlyLimit);
  // Estimate batch offset: ~2-4 minutes between dispatches in queue
  const estimatedDelayMinutes = (queuePosition - 1) * Math.max(2, Math.floor(60 / effectiveHourly));
  const estimatedDate = new Date(nextWindowUtc.getTime() + estimatedDelayMinutes * 60 * 1000);

  const isToday = new Date().toDateString() === estimatedDate.toDateString();
  const timeStr = estimatedDate.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  if (isToday) {
    return `Today @ ${timeStr} (Queue #${queuePosition})`;
  }

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (tomorrow.toDateString() === estimatedDate.toDateString()) {
    return `Tomorrow @ ${timeStr} (Queue #${queuePosition})`;
  }

  return `${estimatedDate.toLocaleDateString([], { month: "short", day: "numeric" })} @ ${timeStr} (Queue #${queuePosition})`;
}
