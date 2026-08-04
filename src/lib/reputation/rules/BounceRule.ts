import { SafetyRule, RecommendationType } from '../types';

export const bounceRule: SafetyRule = (context) => {
  if (context.sentToday === 0) return null;

  const bounceRate = context.hardBouncesToday / context.sentToday;
  if (bounceRate >= context.config.maxHardBounceRate) {
    return {
      recommendation: RecommendationType.PAUSE,
      reason: {
        code: 'HARD_BOUNCE_LIMIT',
        message: `Bounce rate ${bounceRate.toFixed(3)} exceeds threshold ${context.config.maxHardBounceRate}`
      }
    };
  }
  return null;
};
