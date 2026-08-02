import { ExecutionQueueItem, ScheduleValidationResult } from "./SchedulingTypes";

export class ScheduleValidator {
  public validate(queue: ExecutionQueueItem[]): ScheduleValidationResult {
    const errors: string[] = [];
    const queueIdSet = new Set<string>();

    for (const item of queue) {
      if (queueIdSet.has(item.queueId)) {
        errors.push(`Duplicate queue ID detected: ${item.queueId}`);
      }
      queueIdSet.add(item.queueId);

      if (!item.scheduledDate || !item.scheduledTime) {
        errors.push(`Missing scheduled date/time for item ${item.queueId}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
