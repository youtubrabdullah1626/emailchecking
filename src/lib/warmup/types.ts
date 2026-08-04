export enum WarmupReason {
  ACCOUNT_PAUSED = 'ACCOUNT_PAUSED',
  INVALID_CONFIG = 'INVALID_CONFIG',
  PROVIDER_RESTRICTION = 'PROVIDER_RESTRICTION',
  DAILY_LIMIT_REACHED = 'DAILY_LIMIT_REACHED',
  WARMUP_STAGE_LIMIT = 'WARMUP_STAGE_LIMIT',
  THROTTLED = 'THROTTLED',
  SAFE_TO_SEND = 'SAFE_TO_SEND'
}

export interface WarmupConfig {
  readonly initialDailyLimit: number;
  readonly dailyIncrement: number;
  readonly maxDailyLimit: number;
}

export interface WarmupContext {
  readonly config: WarmupConfig;
  readonly currentWarmupDay: number;
  readonly emailsSentToday: number;
  
  readonly isAccountPaused: boolean;
  readonly hasProviderRestrictions: boolean;
}

export interface WarmupDecision {
  readonly dailyAllowance: number;
  readonly remainingCapacity: number;
  readonly recommendedBatchSize: number;
  readonly recommendedConcurrency: number;
  readonly recommendedThroughput: number;
  readonly reason: WarmupReason;
  readonly isSafeToSend: boolean;
}

export class WarmupValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WarmupValidationError';
  }
}
