import { WarmupSettings } from "@/lib/warmup/WarmupService";
import { generateWarmupSchedule } from "@/lib/warmup/schedulerEngine";
import { ExecutionQueueItem } from "./SchedulingTypes";
import { SequenceStep } from "@/lib/import/engines/SequenceBuilderEngine";
import { parseISO } from "date-fns";

export class QueueBuilder {
  /**
   * Deterministically assigns timeslots to a batch of steps for a given day.
   */
  public buildDailyQueue(
    campaignId: string,
    timezone: string,
    dateStr: string, // YYYY-MM-DD
    steps: { recordId: string; email: string; step: SequenceStep }[],
    warmupSettings: WarmupSettings | null,
    alreadyScheduledCount: number = 0,
    lastScheduledTime?: string
  ): ExecutionQueueItem[] {
    if (steps.length === 0) return [];

    // Fallback settings if warmup is disabled
    const activeSettings: WarmupSettings = { ...(warmupSettings || {
      enabled: true,
      businessDaysOnly: false,
      startingDailyEmails: steps.length + alreadyScheduledCount,
      maxDailyEmails: steps.length + alreadyScheduledCount,
      warmupDurationDays: 1,
      sendingWindow: "09:00-17:00",
      timezone: timezone,
    })};

    if (lastScheduledTime) {
      const [lastHours, lastMins] = lastScheduledTime.split(":").map(Number);
      let newStartMins = lastHours * 60 + lastMins + 1;
      const endWindowParts = activeSettings.sendingWindow.split("-")[1];
      const [endHours, endMins] = endWindowParts.split(":").map(Number);
      const endTotalMins = endHours * 60 + endMins;
      
      if (newStartMins > endTotalMins - 5) newStartMins = endTotalMins - 5;
      
      const newStartHour = Math.floor(newStartMins / 60).toString().padStart(2, '0');
      const newStartMin = (newStartMins % 60).toString().padStart(2, '0');
      activeSettings.sendingWindow = `${newStartHour}:${newStartMin}-${endWindowParts}`;
    }

    const targetDate = parseISO(dateStr);
    
    // Smart Current-Day Clamp using proper timezone:
    // If we are scheduling for "today" in the specified timezone, we must ensure we don't schedule in the past.
    const now = new Date();
    let tzDateStr = "";
    let currentHours = now.getHours();
    let currentMins = now.getMinutes();
    
    try {
      const tzOptions = { timeZone: timezone, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' } as const;
      const parts = new Intl.DateTimeFormat('en-US', tzOptions).formatToParts(now);
      const p = (type: string) => parts.find(p => p.type === type)?.value || "";
      tzDateStr = `${p('year')}-${p('month')}-${p('day')}`;
      let h = parseInt(p('hour'), 10);
      if (h === 24) h = 0;
      currentHours = h;
      currentMins = parseInt(p('minute'), 10);
    } catch (e) {
      tzDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }
    
    if (dateStr === tzDateStr) {
      const currentTotalMins = currentHours * 60 + currentMins;
      
      const [startWindowStr, endWindowStr] = activeSettings.sendingWindow.split("-");
      const [startH, startM] = startWindowStr.split(":").map(Number);
      const [endH, endM] = endWindowStr.split(":").map(Number);
      
      const startTotalMins = startH * 60 + startM;
      const endTotalMins = endH * 60 + endM;
      
      if (currentTotalMins > startTotalMins) {
        let newStartMins = currentTotalMins + 5; // 5 minute buffer
        if (newStartMins > endTotalMins - 5) {
          // If less than 5 mins left, cap it safely at the end
          newStartMins = endTotalMins - 5;
        }
        
        // Update the sending window string dynamically for the generator
        const newStartHour = Math.floor(newStartMins / 60).toString().padStart(2, '0');
        const newStartMin = (newStartMins % 60).toString().padStart(2, '0');
        activeSettings.sendingWindow = `${newStartHour}:${newStartMin}-${endWindowStr}`;
      }
    }
    
    // Generate exactly enough slots for the new items in the remaining time window
    const timeSlots = generateWarmupSchedule(activeSettings, targetDate, steps.length);

    // Sort steps to ensure priority: Lower step number first, then stable string sort
    const sortedSteps = [...steps].sort((a, b) => {
      if (a.step.stepNumber !== b.step.stepNumber) {
        return a.step.stepNumber - b.step.stepNumber;
      }
      return a.recordId.localeCompare(b.recordId);
    });

    const queueItems: ExecutionQueueItem[] = [];

    for (let i = 0; i < sortedSteps.length; i++) {
      const stepInfo = sortedSteps[i];
      // If generateWarmupSchedule capped out, fallback to 09:00
      const timeStr = timeSlots[i] || "09:00"; 
      
      // Compute UTC timestamp strictly
      // e.g. "2024-01-01T09:00:00" in "America/New_York"
      const localDateTimeStr = `${dateStr}T${timeStr}:00`;
      
      // Note: We use basic string manipulation for the UI representation
      // For absolute timestamping, we would use a robust timezone parser.
      // For Phase 14 UI, we just simulate the UTC value loosely for sorting priority.
      const pseudoUtcTimestamp = new Date(localDateTimeStr).getTime();

      queueItems.push({
        queueId: `${campaignId}_${stepInfo.recordId}_s${stepInfo.step.stepNumber}`,
        campaignId,
        recordId: stepInfo.recordId,
        recipientEmail: stepInfo.email,
        sequenceStep: stepInfo.step,
        scheduledDate: dateStr,
        scheduledTime: timeStr,
        scheduledTimestamp: pseudoUtcTimestamp,
        timezone: timezone,
        priority: stepInfo.step.stepNumber
      });
    }

    return queueItems;
  }
}
