import { 
  WarmupContext, 
  WarmupDecision, 
  WarmupReason, 
  WarmupValidationError 
} from './types';

function validateContext(context: WarmupContext): void {
  if (context.currentWarmupDay < 1) {
    throw new WarmupValidationError('Current warm-up day must be at least 1.');
  }
  if (context.emailsSentToday < 0) {
    throw new WarmupValidationError('Emails sent today cannot be negative.');
  }
  if (context.config.initialDailyLimit <= 0) {
    throw new WarmupValidationError('Initial daily limit must be greater than 0.');
  }
  if (context.config.dailyIncrement < 0) {
    throw new WarmupValidationError('Daily increment cannot be negative.');
  }
  if (context.config.maxDailyLimit < context.config.initialDailyLimit) {
    throw new WarmupValidationError('Max daily limit cannot be less than initial daily limit.');
  }
}

/**
 * Pure mathematical engine for Warm-up decision making.
 * Owns only capacity, throttling, and safety logic.
 * Never executes actions, hits the DB, or calculates send times.
 */
export function calculateWarmup(context: WarmupContext): WarmupDecision {
  // 1. Fail-fast Validation
  validateContext(context);

  // 2. Safety Validation (Priority 1)
  if (context.isAccountPaused) {
    return Object.freeze({
      dailyAllowance: 0,
      remainingCapacity: 0,
      recommendedBatchSize: 0,
      recommendedConcurrency: 0,
      recommendedThroughput: 0,
      reason: WarmupReason.ACCOUNT_PAUSED,
      isSafeToSend: false
    });
  }

  if (context.hasProviderRestrictions) {
    return Object.freeze({
      dailyAllowance: 0,
      remainingCapacity: 0,
      recommendedBatchSize: 0,
      recommendedConcurrency: 0,
      recommendedThroughput: 0,
      reason: WarmupReason.PROVIDER_RESTRICTION,
      isSafeToSend: false
    });
  }

  // 3. Calculate daily capacity (Linear Ramp Algorithm)
  const calculatedAllowance = context.config.initialDailyLimit + ((context.currentWarmupDay - 1) * context.config.dailyIncrement);
  const dailyAllowance = Math.min(calculatedAllowance, context.config.maxDailyLimit);

  // 4. Calculate remaining capacity
  const remainingCapacity = Math.max(0, dailyAllowance - context.emailsSentToday);

  // 5. Determine State and Reason
  let reason = WarmupReason.SAFE_TO_SEND;
  let isSafeToSend = true;
  
  if (remainingCapacity === 0) {
    reason = WarmupReason.DAILY_LIMIT_REACHED;
    isSafeToSend = false;
  } else if (dailyAllowance < context.config.maxDailyLimit) {
    reason = WarmupReason.WARMUP_STAGE_LIMIT;
  }

  // 6. Calculate recommended sending capacity (Auto Throttling)
  // These are recommendations to be consumed by the orchestration layer.
  let batchSize = 50;
  let concurrency = 5;
  let throughput = 10;

  if (remainingCapacity > 0 && remainingCapacity < 25) {
    // Aggressive mathematical throttle when approaching daily limit to prevent bursting
    batchSize = Math.min(remainingCapacity, 5);
    concurrency = 1;
    throughput = 1;
    reason = WarmupReason.THROTTLED;
  } else if (dailyAllowance < context.config.maxDailyLimit) {
    // Moderate throttle during the warm-up ramp phase
    batchSize = 25;
    concurrency = 2;
    throughput = 5;
  }

  if (!isSafeToSend) {
    batchSize = 0;
    concurrency = 0;
    throughput = 0;
  }

  // 7. Immutable Output
  return Object.freeze({
    dailyAllowance,
    remainingCapacity,
    recommendedBatchSize: batchSize,
    recommendedConcurrency: concurrency,
    recommendedThroughput: throughput,
    reason,
    isSafeToSend
  });
}
