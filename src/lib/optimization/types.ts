export enum ActivityScore {
  VERY_HIGH = 'VERY_HIGH',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
  UNKNOWN = 'UNKNOWN'
}

export interface OptimizationReason {
  readonly code: string;
  readonly message: string;
}

export interface DeliveryWindow {
  readonly startHour: number; // 0-23
  readonly endHour: number;   // 0-23
  readonly timezone: string;
}

export interface OptimizationConfig {
  readonly defaultBusinessStartHour: number;
  readonly defaultBusinessEndHour: number;
  readonly defaultBusinessDays: number[]; // 0=Sun, 1=Mon, etc.
}

export interface RecipientStats {
  readonly historicalOpens: number;
  readonly historicalReplies: number;
  readonly historicalClicks: number;
}

export interface OptimizationContext {
  readonly config: OptimizationConfig;
  readonly recipientTimezone: string;
  readonly recipientStats?: RecipientStats;
}

export interface OptimizationDecision {
  readonly score: ActivityScore;
  readonly deliveryWindows: ReadonlyArray<DeliveryWindow>;
  readonly reasons: ReadonlyArray<OptimizationReason>;
}

export interface OptimizationRuleResult {
  readonly scoreRecommendation?: ActivityScore;
  readonly windowRecommendation?: DeliveryWindow;
  readonly reason?: OptimizationReason;
}

// Pure independent rule - never reads another rule's output
export type OptimizationRule = (context: OptimizationContext) => OptimizationRuleResult | null;
