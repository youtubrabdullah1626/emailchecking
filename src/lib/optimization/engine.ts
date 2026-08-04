import { OptimizationContext, OptimizationDecision, ActivityScore, OptimizationRule, OptimizationReason, DeliveryWindow } from './types';
import { businessHoursRule } from './rules/BusinessHoursRule';
import { engagementRule } from './rules/EngagementRule';

const ACTIVE_RULES: OptimizationRule[] = [
  businessHoursRule,
  engagementRule
];

function scoreToNumeric(score: ActivityScore): number {
  switch (score) {
    case ActivityScore.UNKNOWN: return 0;
    case ActivityScore.LOW: return 1;
    case ActivityScore.MEDIUM: return 2;
    case ActivityScore.HIGH: return 3;
    case ActivityScore.VERY_HIGH: return 4;
  }
}

function mergeScores(current: ActivityScore, next: ActivityScore): ActivityScore {
  return scoreToNumeric(next) > scoreToNumeric(current) ? next : current;
}

/**
 * Pure Activity Optimization Engine
 * Evaluates context deterministically through perfectly isolated, independent rules.
 * Does NOT execute actions, write to DB, or calculate explicit queues/schedules.
 */
export function evaluateOptimization(context: OptimizationContext): OptimizationDecision {
  let finalScore = ActivityScore.UNKNOWN;
  const windows: DeliveryWindow[] = [];
  const reasons: OptimizationReason[] = [];

  // Rules are evaluated independently. They NEVER read each other's output.
  for (const rule of ACTIVE_RULES) {
    const result = rule(context);
    if (result) {
      if (result.scoreRecommendation) {
        finalScore = mergeScores(finalScore, result.scoreRecommendation);
      }
      if (result.windowRecommendation) {
        windows.push(result.windowRecommendation);
      }
      if (result.reason) {
        reasons.push(result.reason);
      }
    }
  }

  // Ensure absolute immutability of the final decision tree
  return Object.freeze({
    score: finalScore,
    deliveryWindows: Object.freeze([...windows]),
    reasons: Object.freeze([...reasons])
  });
}
