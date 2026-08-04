import { SafetyRule, RecommendationType } from '../types';

export const errorRule: SafetyRule = (context) => {
  if (context.consecutiveErrors >= context.config.maxConsecutiveErrors) {
    return {
      recommendation: RecommendationType.PAUSE,
      reason: {
        code: 'PROVIDER_FAILURE',
        message: `${context.consecutiveErrors} consecutive provider errors reached.`
      }
    };
  }
  return null;
};
