import { WarmupSettings, WarmupStatus } from "@/lib/warmup/WarmupService";
import { addDays, isWeekend, format, parseISO } from "date-fns";
import { calculateRampState } from "@/lib/warmup/rampEngine"; // Reusing pure ramp logic for future dates

export type SpeedProfile = "Conservative" | "Balanced" | "Aggressive" | "Custom";

export interface CampaignConfig {
  campaignName: string;
  startDate: string; // ISO string
  timezone: string;
  businessDaysOnly: boolean;
  speedProfile: SpeedProfile;
  customDailyLimit: number; // Used if SpeedProfile === "Custom"
  integrateWarmup: boolean;
}

export interface DailyForecast {
  date: string;
  dayOfWeek: string;
  leadsSent: number;
  warmupLimitApplied: boolean;
  isBusinessDaySkipped: boolean;
}

export interface ForecastResult {
  totalLeads: number;
  estimatedCompletionDate: string | null;
  campaignDurationDays: number;
  actualSendingDays: number;
  dailyForecast: DailyForecast[];
}

export class ForecastEngine {
  private getBaseDailyLimit(profile: SpeedProfile, customLimit: number): number {
    switch (profile) {
      case "Conservative": return 50;
      case "Balanced": return 150;
      case "Aggressive": return 300;
      case "Custom": return customLimit > 0 ? customLimit : 150;
    }
  }

  public calculateForecast(
    totalLeads: number,
    config: CampaignConfig,
    warmupStatus: WarmupStatus | null,
    warmupSettings: WarmupSettings | null
  ): ForecastResult {
    if (totalLeads <= 0) {
      return { totalLeads: 0, estimatedCompletionDate: null, campaignDurationDays: 0, actualSendingDays: 0, dailyForecast: [] };
    }

    const dailyForecast: DailyForecast[] = [];
    const baseLimit = this.getBaseDailyLimit(config.speedProfile, config.customDailyLimit);
    
    let currentDate = parseISO(config.startDate);
    let leadsRemaining = totalLeads;
    let actualSendingDays = 0;
    let totalElapsedDays = 0;

    // Hard cap to prevent infinite loops in edge cases
    const MAX_DAYS = 365 * 2; 

    while (leadsRemaining > 0 && totalElapsedDays < MAX_DAYS) {
      const isWknd = isWeekend(currentDate);
      const skipForBusinessDay = config.businessDaysOnly && isWknd;

      let warmupDailyTarget = Infinity;
      let warmupLimitApplied = false;

      // Integrate Warmup
      if (config.integrateWarmup && warmupStatus && warmupSettings && warmupStatus.status !== "NOT_STARTED") {
        if (warmupSettings.businessDaysOnly && isWknd) {
          // Warmup skips weekends, so we have 0 warmup capacity today
          warmupDailyTarget = 0;
        } else {
          // Calculate the projected warmup daily target for this specific future date
          // Since we are reusing the pure rampEngine, we can pass the startDate and the future date
          if (warmupStatus.startDate) {
            const projectedRamp = calculateRampState(warmupStatus.startDate, currentDate, warmupSettings);
            warmupDailyTarget = projectedRamp.dailyTarget;
          }
        }
      }

      const dailyCapacity = skipForBusinessDay ? 0 : Math.min(baseLimit, warmupDailyTarget);
      
      if (dailyCapacity > 0) {
        warmupLimitApplied = dailyCapacity === warmupDailyTarget && dailyCapacity < baseLimit;
      }

      const leadsSentToday = Math.min(leadsRemaining, dailyCapacity);
      
      dailyForecast.push({
        date: format(currentDate, "yyyy-MM-dd"),
        dayOfWeek: format(currentDate, "EEEE"),
        leadsSent: leadsSentToday,
        warmupLimitApplied,
        isBusinessDaySkipped: skipForBusinessDay
      });

      leadsRemaining -= leadsSentToday;
      
      if (leadsSentToday > 0) {
        actualSendingDays++;
      }

      if (leadsRemaining > 0) {
        currentDate = addDays(currentDate, 1);
        totalElapsedDays++;
      }
    }

    return {
      totalLeads,
      estimatedCompletionDate: dailyForecast.length > 0 ? dailyForecast[dailyForecast.length - 1].date : null,
      campaignDurationDays: totalElapsedDays + 1,
      actualSendingDays,
      dailyForecast
    };
  }
}
