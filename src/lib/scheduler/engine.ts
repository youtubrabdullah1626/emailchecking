import { addSeconds, addDays, setHours, setMinutes, setSeconds, setMilliseconds } from 'date-fns';
import { toZonedTime, fromZonedTime, format } from 'date-fns-tz';
import { 
  SchedulingContext, 
  SchedulingDecision, 
  SchedulingReason, 
  SchedulerValidationError,
  SchedulingRule
} from './types';
import { BusinessHoursRule } from './rules/BusinessHoursRule';
import { JitterRule } from './rules/JitterRule';

/**
 * Validates the scheduling context configuration.
 * Throws structured errors immediately if configuration is mathematically invalid.
 */
function validateContext(context: SchedulingContext): void {
  if (context.minIntervalSeconds < 0 || context.maxIntervalSeconds < 0) {
    throw new SchedulerValidationError('Interval seconds must be non-negative.');
  }
  if (context.minIntervalSeconds > context.maxIntervalSeconds) {
    throw new SchedulerValidationError('minIntervalSeconds cannot be greater than maxIntervalSeconds.');
  }

  const { businessHours } = context;
  if (!businessHours || !businessHours.activeDays || businessHours.activeDays.length === 0) {
    throw new SchedulerValidationError('At least one active business day must be configured.');
  }

  // Validate HH:mm formats (naive validation)
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  if (!timeRegex.test(businessHours.startTime) || !timeRegex.test(businessHours.endTime)) {
    throw new SchedulerValidationError('Business hours must be in HH:mm format.');
  }

  if (businessHours.startTime >= businessHours.endTime) {
    throw new SchedulerValidationError('Business hour startTime must be before endTime.');
  }

  if (!context.recipientTimezone && !context.campaignDefaultTimezone) {
    throw new SchedulerValidationError('A valid timezone (recipient or campaign default) must be provided.');
  }
}

/**
 * Resolves the appropriate timezone to use.
 */
function resolveTimezone(context: SchedulingContext): string {
  if (context.recipientTimezone && context.recipientTimezone.trim() !== '') {
    return context.recipientTimezone;
  }
  return context.campaignDefaultTimezone as string;
}

/**
 * Mathematically calculates the absolute optimal send time using a pure Rule Engine.
 * This performs ZERO side effects and strictly follows the Open/Closed Principle.
 * 
 * @param context The immutable scheduling configuration context.
 * @param customRules Optional array of rules. If empty, uses standard rules.
 * @returns An immutable SchedulingDecision.
 */
export function calculateSchedule(context: SchedulingContext, customRules?: SchedulingRule[]): SchedulingDecision {
  // 1. Fail-fast Validation
  validateContext(context);

  // 2. Resolve Timezone
  const timezone = resolveTimezone(context);
  const reasons = new Set<SchedulingReason>();

  // 3. Project current UTC time into the Target Timezone
  let targetTimeZoned = toZonedTime(context.currentUtcTime, timezone);
  let totalShifted = false;

  // 4. Initialize Rule Engine
  const rules = customRules || [
    new BusinessHoursRule(),
    new JitterRule()
  ];

  // 5. Execute Rules Pipeline
  for (const rule of rules) {
    const result = rule.apply(context, targetTimeZoned, timezone);
    targetTimeZoned = result.newTargetTime;
    
    if (result.shifted) {
      totalShifted = true;
    }
    
    if (result.reason) {
      reasons.add(result.reason);
    }
  }

  if (reasons.size === 0) {
    reasons.add(SchedulingReason.OPTIMAL);
  }

  // 6. Convert back to absolute UTC for execution
  const finalUtcTime = fromZonedTime(targetTimeZoned, timezone);
  const localIsoString = format(targetTimeZoned, "yyyy-MM-dd'T'HH:mm:ssXXX", { timeZone: timezone });
  
  // Calculate delay perfectly deterministically
  const delaySeconds = Math.round((finalUtcTime.getTime() - context.currentUtcTime.getTime()) / 1000);

  // 7. Output Result (Immutable)
  return Object.freeze({
    recommendedSendTimeUtc: finalUtcTime,
    recipientLocalTime: localIsoString,
    delayAppliedSeconds: Math.max(0, delaySeconds),
    appliedRules: Array.from(reasons)
  });
}
