import { CampaignSequence, SequenceStep } from "@/lib/import/engines/SequenceBuilderEngine";
import { CampaignConfig } from "@/lib/import/engines/ForecastEngine";
import { WarmupSettings, WarmupStatus } from "@/lib/warmup/WarmupService";
import { ExecutionQueueItem, QueueSummary } from "./SchedulingTypes";
import { QueueBuilder } from "./QueueBuilder";
import { parseISO, addDays, isWeekend, format } from "date-fns";
import { calculateRampState } from "@/lib/warmup/rampEngine";

interface PendingSequence {
  recordId: string;
  email: string;
  steps: SequenceStep[];
  nextEligibilityDate: string | null;
}

export class SchedulingEngine {
  private queueBuilder = new QueueBuilder();

  private getBaseDailyLimit(profile: string, customLimit: number): number {
    switch (profile) {
      case "Conservative": return 50;
      case "Balanced": return 150;
      case "Aggressive": return 300;
      case "Custom": return customLimit > 0 ? customLimit : 150;
      default: return 150;
    }
  }

  /**
   * Generator-based daily scheduler. 
   * Yields one day of scheduled items at a time to prevent UI thread blocking.
   */
  public *generateSchedule(
    campaignId: string,
    sequences: CampaignSequence[],
    config: CampaignConfig,
    warmupStatus: WarmupStatus | null,
    warmupSettings: WarmupSettings | null,
    existingQueue: ExecutionQueueItem[] = [],
    globalQueue: ExecutionQueueItem[] = [],
    allowDuplicates: boolean = false
  ): Generator<{ date: string; items: ExecutionQueueItem[]; isWarmupThrottled: boolean; complete: boolean; existingQueueMetrics?: any }> {
    
    // Fast lookup for duplicates globally to prevent cross-campaign spam
    const existingEmails = allowDuplicates ? new Set<string>() : new Set([
      ...existingQueue.map(q => q.recipientEmail.toLowerCase().trim()),
      ...globalQueue.map(q => q.recipientEmail.toLowerCase().trim())
    ]);
    
    // Filter duplicates out of pending sequences entirely
    let skippedCount = 0;
    const pendingSequences: PendingSequence[] = sequences
      .filter(seq => {
        if (existingEmails.has(seq.recipientEmail.toLowerCase().trim())) {
          skippedCount++;
          return false;
        }
        return true;
      })
      .map(seq => ({
        recordId: seq.recordId,
        email: seq.recipientEmail,
        steps: [...seq.steps].sort((a, b) => a.stepNumber - b.stepNumber),
        nextEligibilityDate: config.startDate
      }));

    let currentDate = parseISO(config.startDate);
    
    // Smart Append: Ensure appended leads never cut the line by backfilling days before the existing schedule's tail.
    if (existingQueue.length > 0) {
      const existingDates = existingQueue.map(q => q.scheduledDate).sort();
      const maxExistingDateStr = existingDates[existingDates.length - 1];
      if (maxExistingDateStr) {
        const maxExistingDate = parseISO(maxExistingDateStr);
        if (maxExistingDate > currentDate) {
          currentDate = maxExistingDate;
        }
      }
    }

    let activePendingCount = pendingSequences.filter(p => p.steps.length > 0).length;
    const baseLimit = this.getBaseDailyLimit(config.speedProfile, config.customDailyLimit);
    
    // Safety break
    let loopCount = 0;
    const MAX_DAYS = 365 * 2; 

    while (activePendingCount > 0 && loopCount < MAX_DAYS) {
      loopCount++;
      const dateStr = format(currentDate, "yyyy-MM-dd");
      const isWknd = isWeekend(currentDate);
      const skipForBusinessDay = config.businessDaysOnly && isWknd;

      // Check if today's window is already closed in the target timezone
      const now = new Date();
      let tzDateStr = "";
      let currentHours = now.getHours();
      let currentMins = now.getMinutes();
      
      try {
        const tzOptions = { timeZone: config.timezone, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' } as const;
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

      const isToday = dateStr === tzDateStr;
      // Check how much capacity is ALREADY consumed by the GLOBAL queue on this exact date
      const itemsOnDate = globalQueue.filter(q => q.scheduledDate === dateStr);
      const allItemsOnDate = new Map<string, ExecutionQueueItem>();
      itemsOnDate.forEach(q => allItemsOnDate.set(q.queueId, q));
      existingQueue.filter(q => q.scheduledDate === dateStr).forEach(q => allItemsOnDate.set(q.queueId, q));
      
      const alreadyScheduledOnDate = allItemsOnDate.size;
      
      let lastScheduledTimeStr: string | undefined;
      if (alreadyScheduledOnDate > 0) {
        lastScheduledTimeStr = Array.from(allItemsOnDate.values()).map(q => q.scheduledTime).sort().pop();
      }

      const sendingWindow = warmupSettings?.sendingWindow || "09:00-17:00";
      const [startWindowStr, endWindowStr] = sendingWindow.split("-");
      const [startH, startM] = startWindowStr.split(":").map(Number);
      const [endH, endM] = endWindowStr.split(":").map(Number);
      const startTotalMins = startH * 60 + startM;
      const endTotalMins = endH * 60 + endM;

      let isWindowClosed = false;
      let minStartMins = startTotalMins;

      if (isToday) {
        const currentTotalMins = currentHours * 60 + currentMins;
        minStartMins = Math.max(minStartMins, currentTotalMins + 5);
      }

      if (lastScheduledTimeStr) {
        const [lastH, lastM] = lastScheduledTimeStr.split(":").map(Number);
        minStartMins = Math.max(minStartMins, lastH * 60 + lastM + 1);
      }

      let remainingMinutesForDay = Infinity;
      if (minStartMins >= endTotalMins - 5) {
        isWindowClosed = true;
        remainingMinutesForDay = 0;
      } else {
        remainingMinutesForDay = endTotalMins - minStartMins;
      }

      // 1. Calculate Daily Capacity
      let warmupDailyTarget = Infinity;
      if (config.integrateWarmup && warmupStatus && warmupSettings && warmupStatus.status !== "NOT_STARTED") {
        if (warmupStatus.status === "PAUSED") {
          throw new Error("Cannot schedule campaign: Global Warmup is paused but the campaign is configured to integrate with it. Please resume Warmup or disable Warmup integration.");
        }
        if (warmupSettings.businessDaysOnly && isWknd) {
          warmupDailyTarget = 0;
        } else if (warmupStatus.startDate) {
          const projectedRamp = calculateRampState(warmupStatus.startDate, currentDate, warmupSettings);
          warmupDailyTarget = projectedRamp.dailyTarget;
        }
      }

      const rawDailyCapacity = (skipForBusinessDay || isWindowClosed) ? 0 : Math.min(baseLimit, warmupDailyTarget, remainingMinutesForDay);
      // Remaining capacity after existing items are subtracted
      const dailyCapacity = Math.max(0, rawDailyCapacity - alreadyScheduledOnDate);
      
      const isWarmupThrottled = rawDailyCapacity === warmupDailyTarget && rawDailyCapacity < baseLimit;

      // 2. Select Eligible Steps for this date
      const eligibleSteps: { recordId: string; email: string; step: SequenceStep }[] = [];
      
      if (dailyCapacity > 0) {
        // Find all pending sequences eligible for today
        const eligibleSequences = pendingSequences.filter(p => 
          p.steps.length > 0 && p.nextEligibilityDate && p.nextEligibilityDate <= dateStr
        );

        // Sort them. We want Step 1s to have priority over Step 2s.
        eligibleSequences.sort((a, b) => {
          if (a.steps[0].stepNumber !== b.steps[0].stepNumber) {
            return a.steps[0].stepNumber - b.steps[0].stepNumber;
          }
          return a.recordId.localeCompare(b.recordId); // stable fallback
        });

        // Pick up to dailyCapacity
        const selectionCount = Math.min(dailyCapacity, eligibleSequences.length);
        for (let i = 0; i < selectionCount; i++) {
          const seq = eligibleSequences[i];
          const nextStep = seq.steps.shift(); // Remove it from pending
          if (nextStep) {
            eligibleSteps.push({
              recordId: seq.recordId,
              email: seq.email,
              step: nextStep
            });

            // If there are more steps, set eligibility for the NEXT step based on delayDays
            if (seq.steps.length > 0) {
              const delay = seq.steps[0].delayDays || 2;
              seq.nextEligibilityDate = format(addDays(currentDate, delay), "yyyy-MM-dd");
            } else {
              seq.nextEligibilityDate = null;
            }
          }
        }
      }

      // 3. Generate Timestamps
      let dailyItems: ExecutionQueueItem[] = [];
      if (eligibleSteps.length > 0) {
        dailyItems = this.queueBuilder.buildDailyQueue(
          campaignId,
          config.timezone,
          dateStr,
          eligibleSteps,
          warmupSettings,
          alreadyScheduledOnDate,
          lastScheduledTimeStr
        );
      }

      activePendingCount = pendingSequences.filter(p => p.steps.length > 0).length;

      // Yield the day's batch
      yield {
        date: dateStr,
        items: dailyItems,
        isWarmupThrottled,
        complete: activePendingCount === 0,
        existingQueueMetrics: {
          skippedDuplicates: skippedCount,
          totalExistingScheduled: existingQueue.length
        }
      };

      currentDate = addDays(currentDate, 1);
    }
  }
}
