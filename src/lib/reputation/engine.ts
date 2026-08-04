import { SafetyContext, SafetyDecision, RecommendationType, SafetyRule, SafetyValidationError, SafetyReason } from './types';
import { bounceRule } from './rules/BounceRule';
import { complaintRule } from './rules/ComplaintRule';
import { errorRule } from './rules/ErrorRule';

const ACTIVE_RULES: SafetyRule[] = [
  bounceRule,
  complaintRule,
  errorRule
];

function validateContext(context: SafetyContext): void {
  if (context.config.maxHardBounceRate < 0 || context.config.maxHardBounceRate > 1) {
    throw new SafetyValidationError('maxHardBounceRate must be between 0 and 1');
  }
  if (context.config.maxComplaintRate < 0 || context.config.maxComplaintRate > 1) {
    throw new SafetyValidationError('maxComplaintRate must be between 0 and 1');
  }
  if (context.config.maxConsecutiveErrors < 0) {
    throw new SafetyValidationError('maxConsecutiveErrors cannot be negative');
  }
  if (context.sentToday < 0) {
    throw new SafetyValidationError('sentToday cannot be negative');
  }
}

function escalate(current: RecommendationType, next: RecommendationType): RecommendationType {
    // Defines strictly typed hierarchy. The worst recommendation wins.
    const hierarchy: Record<RecommendationType, number> = {
        [RecommendationType.SAFE]: 0,
        [RecommendationType.AUTO_RESUME_ALLOWED]: 1,
        [RecommendationType.THROTTLE]: 2,
        [RecommendationType.MANUAL_REVIEW]: 3,
        [RecommendationType.PAUSE]: 4,
        [RecommendationType.REMAIN_PAUSED]: 5,
    };
    return hierarchy[next] > hierarchy[current] ? next : current;
}

/**
 * Pure Safety Engine
 * Evaluates context deterministically through perfectly isolated, independent rules.
 * Does NOT execute actions, write to DB, or manage schedules.
 */
export function evaluateSafety(context: SafetyContext): SafetyDecision {
  validateContext(context);

  let highestEscalation = RecommendationType.SAFE;
  const reasons: SafetyReason[] = [];

  // Rules are evaluated independently. They NEVER read each other's output.
  for (const rule of ACTIVE_RULES) {
    const result = rule(context);
    if (result) {
        if (result.recommendation) {
            highestEscalation = escalate(highestEscalation, result.recommendation);
        }
        if (result.reason) {
            reasons.push(result.reason);
        }
    }
  }

  let finalRecommendation = highestEscalation;

  // Resolve base state transitions via contextual inference, preventing duplicating logic in rules.
  if (context.currentStatus === 'PAUSED') {
    if (highestEscalation === RecommendationType.SAFE) {
      finalRecommendation = RecommendationType.AUTO_RESUME_ALLOWED;
      reasons.push({ code: 'AUTO_RESUME_ALLOWED', message: 'All safety thresholds are normal. Safe to resume.' });
    } else {
      finalRecommendation = RecommendationType.REMAIN_PAUSED;
      // reasons array already populated with the violations from the active rules.
    }
  }

  // Ensure absolute immutability of the final decision tree
  return Object.freeze({
    recommendation: finalRecommendation,
    reasons: Object.freeze([...reasons])
  });
}
