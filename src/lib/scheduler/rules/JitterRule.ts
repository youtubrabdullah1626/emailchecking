import { addSeconds } from 'date-fns';
import { SchedulingContext, SchedulingRule, RuleResult, SchedulingReason } from '../types';

export class JitterRule implements SchedulingRule {
  readonly name = 'JitterRule';

  apply(context: SchedulingContext, targetTimeZoned: Date, timezone: string): RuleResult {
    if (context.randomJitterSeconds > 0) {
      return {
        newTargetTime: addSeconds(targetTimeZoned, context.randomJitterSeconds),
        reason: SchedulingReason.RANDOMIZED_INTERVAL,
        shifted: true
      };
    }
    
    return {
      newTargetTime: targetTimeZoned,
      reason: null,
      shifted: false
    };
  }
}
