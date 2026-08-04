import { addDays, setHours, setMinutes, setSeconds, setMilliseconds } from 'date-fns';
import { SchedulingContext, SchedulingRule, RuleResult, SchedulingReason } from '../types';

export class BusinessHoursRule implements SchedulingRule {
  readonly name = 'BusinessHoursRule';

  apply(context: SchedulingContext, targetTimeZoned: Date, timezone: string): RuleResult {
    const { businessHours } = context;
    const [startHour, startMinute] = businessHours.startTime.split(':').map(Number);
    const [endHour, endMinute] = businessHours.endTime.split(':').map(Number);

    let shifted = false;
    let newTargetTime = new Date(targetTimeZoned.getTime());
    let safetyCounter = 0;
    let appliedReason: SchedulingReason | null = null;
    
    while (safetyCounter < 14) {
      const currentDay = newTargetTime.getDay();
      const currentHour = newTargetTime.getHours();
      const currentMinute = newTargetTime.getMinutes();
      
      const isDayActive = businessHours.activeDays.includes(currentDay);
      const currentFloat = currentHour + currentMinute / 60;
      const startFloat = startHour + startMinute / 60;
      const endFloat = endHour + endMinute / 60;

      if (!isDayActive || currentFloat >= endFloat) {
        newTargetTime = addDays(newTargetTime, 1);
        newTargetTime = setHours(newTargetTime, startHour);
        newTargetTime = setMinutes(newTargetTime, startMinute);
        newTargetTime = setSeconds(newTargetTime, 0);
        newTargetTime = setMilliseconds(newTargetTime, 0);
        shifted = true;
        appliedReason = isDayActive ? SchedulingReason.BUSINESS_HOURS_SHIFT : SchedulingReason.WEEKEND_SHIFT;
      } else if (currentFloat < startFloat) {
        newTargetTime = setHours(newTargetTime, startHour);
        newTargetTime = setMinutes(newTargetTime, startMinute);
        newTargetTime = setSeconds(newTargetTime, 0);
        newTargetTime = setMilliseconds(newTargetTime, 0);
        shifted = true;
        appliedReason = SchedulingReason.BUSINESS_HOURS_SHIFT;
      } else {
        break;
      }
      
      safetyCounter++;
    }

    return {
      newTargetTime,
      reason: appliedReason,
      shifted
    };
  }
}
