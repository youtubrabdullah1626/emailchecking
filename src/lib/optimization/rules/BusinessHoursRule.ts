import { OptimizationRule } from '../types';

export const businessHoursRule: OptimizationRule = (context) => {
  if (!context.recipientTimezone) return null;

  return {
    windowRecommendation: {
      startHour: context.config.defaultBusinessStartHour,
      endHour: context.config.defaultBusinessEndHour,
      timezone: context.recipientTimezone
    },
    reason: {
      code: 'DEFAULT_BUSINESS_HOURS',
      message: `Recommending default business hours (${context.config.defaultBusinessStartHour}:00 - ${context.config.defaultBusinessEndHour}:00) based on recipient timezone: ${context.recipientTimezone}.`
    }
  };
};
