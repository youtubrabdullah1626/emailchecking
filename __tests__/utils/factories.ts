import { OptimizationContext, OptimizationConfig, RecipientStats, ActivityScore } from '@/lib/optimization/types';
import { SafetyContext, SafetyConfig, SafetyDecision, RecommendationType } from '@/lib/reputation/types';

// Deterministic factories for test data governance
export class TestFactories {
  static createOptimizationConfig(overrides?: Partial<OptimizationConfig>): OptimizationConfig {
    return {
      defaultBusinessStartHour: 9,
      defaultBusinessEndHour: 17,
      defaultBusinessDays: [1, 2, 3, 4, 5],
      ...overrides
    };
  }

  static createRecipientStats(overrides?: Partial<RecipientStats>): RecipientStats {
    return {
      historicalOpens: 0,
      historicalReplies: 0,
      historicalClicks: 0,
      ...overrides
    };
  }

  static createOptimizationContext(overrides?: Partial<OptimizationContext>): OptimizationContext {
    return {
      config: this.createOptimizationConfig(overrides?.config),
      recipientTimezone: overrides?.recipientTimezone || 'UTC',
      recipientStats: overrides?.recipientStats
    };
  }

  static createSafetyConfig(overrides?: Partial<SafetyConfig>): SafetyConfig {
    return {
      maxHardBounceRate: 0.05,
      maxComplaintRate: 0.01,
      maxConsecutiveErrors: 10,
      ...overrides
    };
  }

  static createSafetyContext(overrides?: Partial<SafetyContext>): SafetyContext {
    return {
      config: this.createSafetyConfig(overrides?.config),
      sentToday: 100,
      hardBouncesToday: 0,
      complaintsToday: 0,
      consecutiveErrors: 0,
      currentStatus: 'ACTIVE',
      ...overrides
    };
  }
}
