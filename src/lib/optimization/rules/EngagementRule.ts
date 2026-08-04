import { OptimizationRule, ActivityScore } from '../types';

export const engagementRule: OptimizationRule = (context) => {
  if (!context.recipientStats) return null;

  const { historicalReplies, historicalOpens, historicalClicks } = context.recipientStats;

  if (historicalReplies > 0) {
    return {
      scoreRecommendation: ActivityScore.VERY_HIGH,
      reason: {
        code: 'HIGH_HISTORICAL_REPLIES',
        message: 'Recipient has previously replied to campaigns.'
      }
    };
  }

  if (historicalOpens > 2 || historicalClicks > 0) {
    return {
      scoreRecommendation: ActivityScore.HIGH,
      reason: {
        code: 'HIGH_HISTORICAL_ENGAGEMENT',
        message: 'Recipient frequently opens or clicks emails.'
      }
    };
  }

  if (historicalOpens > 0) {
    return {
      scoreRecommendation: ActivityScore.MEDIUM,
      reason: {
        code: 'MODERATE_ENGAGEMENT',
        message: 'Recipient has opened emails previously.'
      }
    };
  }

  return {
    scoreRecommendation: ActivityScore.LOW,
    reason: {
      code: 'NO_PRIOR_ENGAGEMENT',
      message: 'Recipient has no prior tracked engagement.'
    }
  };
};
