export enum RecommendationType {
  SAFE = 'SAFE',
  THROTTLE = 'THROTTLE',
  AUTO_RESUME_ALLOWED = 'AUTO_RESUME_ALLOWED',
  MANUAL_REVIEW = 'MANUAL_REVIEW',
  PAUSE = 'PAUSE',
  REMAIN_PAUSED = 'REMAIN_PAUSED'
}

export interface SafetyReason {
  readonly code: string;
  readonly message: string;
}

export interface SafetyConfig {
  readonly maxHardBounceRate: number; // e.g. 0.05 for 5%
  readonly maxComplaintRate: number; // e.g. 0.001 for 0.1%
  readonly maxConsecutiveErrors: number;
}

export interface SafetyContext {
  readonly config: SafetyConfig;
  readonly currentStatus: 'ACTIVE' | 'PAUSED' | 'THROTTLED';
  readonly hardBouncesToday: number;
  readonly complaintsToday: number;
  readonly sentToday: number;
  readonly consecutiveErrors: number;
}

export interface SafetyDecision {
  readonly recommendation: RecommendationType;
  readonly reasons: ReadonlyArray<SafetyReason>;
}

export interface SafetyRuleResult {
  readonly recommendation?: RecommendationType;
  readonly reason?: SafetyReason;
}

// Pure independent rule - never reads another rule's output
export type SafetyRule = (context: SafetyContext) => SafetyRuleResult | null;

export class SafetyValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SafetyValidationError';
  }
}
