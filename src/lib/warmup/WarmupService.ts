export interface WarmupSettings {
  enabled: boolean;
  businessDaysOnly: boolean;
  startingDailyEmails: number;
  maxDailyEmails: number;
  warmupDurationDays: number;
  sendingWindow: string;
  timezone: string;
}

export interface WarmupStatus {
  status: "ACTIVE" | "PAUSED" | "COMPLETED" | "NOT_STARTED";
  currentDay: number;
  nextExecution: string | null;
  lastExecution: string | null;
  dailyTarget: number;
  progressPercent: number;
  startDate: string | null;
  remainingDays: number;
}

export interface IWarmupService {
  getSettings(): Promise<WarmupSettings>;
  updateSettings(settings: Partial<WarmupSettings>): Promise<WarmupSettings>;
  getStatus(): Promise<WarmupStatus>;
  getTodaySchedule(targetDate: Date): Promise<string[]>;
}

import { generateWarmupSchedule } from "./schedulerEngine";
import { calculateRampState } from "./rampEngine";

// Temporary mock implementation isolated behind the interface.
// This ensures the UI never directly depends on mocked state.
export class MockWarmupService implements IWarmupService {
  private _inMemorySettings: WarmupSettings = {
    enabled: true,
    businessDaysOnly: true,
    startingDailyEmails: 5,
    maxDailyEmails: 40,
    warmupDurationDays: 30,
    sendingWindow: "09:00-17:00",
    timezone: "UTC",
  };

  private get settings(): WarmupSettings {
    if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
      try {
        const saved = localStorage.getItem("warmup_settings");
        if (saved) {
          this._inMemorySettings = JSON.parse(saved);
        }
      } catch (e) {
        console.error("Failed to parse warmup settings", e);
      }
    }
    return this._inMemorySettings;
  }

  private set settings(val: WarmupSettings) {
    this._inMemorySettings = val;
    if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
      try {
        localStorage.setItem("warmup_settings", JSON.stringify(val));
      } catch (e) {
        console.error("Failed to save warmup settings", e);
      }
    }
  }

  private startDate: string | null = "2026-07-25"; // A simulated past date

  // Cache implementation
  private cachedSchedule: {
    dateStr: string;
    settingsHash: string;
    schedule: string[];
  } | null = null;

  private getSettingsHash(s: WarmupSettings, dailyTarget: number): string {
    return `${s.enabled}-${s.businessDaysOnly}-${s.sendingWindow}-${s.timezone}-${dailyTarget}`;
  }

  async getSettings(): Promise<WarmupSettings> {
    return new Promise((resolve) => setTimeout(() => resolve({ ...this.settings }), 500));
  }

  async updateSettings(updates: Partial<WarmupSettings>): Promise<WarmupSettings> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const current = this.settings;
        this.settings = { ...current, ...updates };
        resolve({ ...this.settings });
      }, 800);
    });
  }

  async getStatus(): Promise<WarmupStatus> {
    return new Promise((resolve) => {
      setTimeout(() => {
        if (!this.startDate) {
          return resolve({
            status: "NOT_STARTED",
            currentDay: 0,
            nextExecution: null,
            lastExecution: null,
            dailyTarget: 0,
            progressPercent: 0,
            startDate: null,
            remainingDays: this.settings.warmupDurationDays,
          });
        }

        const rampState = calculateRampState(this.startDate, new Date(), this.settings);
        resolve({
          status: rampState.status,
          currentDay: rampState.currentDay,
          nextExecution: null, // Mocks
          lastExecution: null, // Mocks
          dailyTarget: rampState.dailyTarget,
          progressPercent: rampState.progressPercent,
          startDate: this.startDate,
          remainingDays: rampState.remainingDays,
        });
      }, 500);
    });
  }

  async getTodaySchedule(targetDate: Date): Promise<string[]> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const dateStr = targetDate.toISOString().split("T")[0];
        
        let dailyTarget = 0;
        if (this.startDate) {
           dailyTarget = calculateRampState(this.startDate, targetDate, this.settings).dailyTarget;
        }

        const currentHash = this.getSettingsHash(this.settings, dailyTarget);

        // Return cached schedule if date and settings haven't changed
        if (
          this.cachedSchedule &&
          this.cachedSchedule.dateStr === dateStr &&
          this.cachedSchedule.settingsHash === currentHash
        ) {
          resolve([...this.cachedSchedule.schedule]);
          return;
        }

        // Generate new schedule if cache miss
        const newSchedule = generateWarmupSchedule(this.settings, targetDate, dailyTarget);
        
        // Update cache
        this.cachedSchedule = {
          dateStr,
          settingsHash: currentHash,
          schedule: newSchedule,
        };

        resolve([...newSchedule]);
      }, 500); // Simulate network latency
    });
  }
}

// Factory to inject the correct service (mock for now, real API later)
export function getWarmupService(): IWarmupService {
  return new MockWarmupService();
}
