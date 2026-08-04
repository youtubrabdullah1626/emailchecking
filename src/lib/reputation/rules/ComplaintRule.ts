import { SafetyRule, RecommendationType } from '../types';

export const complaintRule: SafetyRule = (context) => {
  if (context.sentToday === 0) return null;

  const complaintRate = context.complaintsToday / context.sentToday;
  if (complaintRate >= context.config.maxComplaintRate) {
    return {
      recommendation: RecommendationType.PAUSE,
      reason: {
        code: 'HIGH_COMPLAINT_RATE',
        message: `Complaint rate ${complaintRate.toFixed(4)} exceeds threshold ${context.config.maxComplaintRate}`
      }
    };
  }
  return null;
};
