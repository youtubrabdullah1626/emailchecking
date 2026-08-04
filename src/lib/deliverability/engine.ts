/**
 * Smart Deliverability Engine
 * 
 * Philosophy: Maximum intelligence internally. Minimum complexity externally.
 * 
 * This engine is strictly stateless and deterministic.
 * It evaluates rules based on context and returns an immutable decision.
 * It does NOT perform side effects, database writes, or email sending.
 */

// -----------------------------------------------------------------------------
// Types & Interfaces
// -----------------------------------------------------------------------------

export interface DeliverabilityContext {
  readonly isSmartDeliverabilityEnabled: boolean;
  readonly provider: string; // e.g., 'GMAIL', 'OUTLOOK', 'SMTP'
  // Future fields: warmupStatus, recipientTimezone, bounceRate, etc.
}

export interface DeliverabilityDecision {
  readonly trackingPixelEnabled: boolean;
  readonly listUnsubscribeEnabled: boolean;
}

// System defaults when Smart Deliverability is OFF or if critical failure occurs.
const DEFAULT_DECISION: DeliverabilityDecision = Object.freeze({
  trackingPixelEnabled: false,
  listUnsubscribeEnabled: false,
});

// A rule is a pure function that takes the context and the *accumulated* decision,
// and returns a partial object with overrides/updates.
type DeliverabilityRule = (
  context: DeliverabilityContext,
  currentDecision: DeliverabilityDecision
) => Partial<DeliverabilityDecision>;


// -----------------------------------------------------------------------------
// Core Rules
// -----------------------------------------------------------------------------

/**
 * Rule: Tracking Optimization
 * Enforces that tracking pixels are always enabled if Smart Deliverability is on.
 */
const trackingOptimizationRule: DeliverabilityRule = (context) => {
  if (context.isSmartDeliverabilityEnabled) {
    return { trackingPixelEnabled: true };
  }
  return {};
};

/**
 * Rule: List-Unsubscribe
 * Evaluates provider requirements to safely inject List-Unsubscribe headers.
 */
const listUnsubscribeRule: DeliverabilityRule = (context) => {
  if (!context.isSmartDeliverabilityEnabled) return {};

  // For Gmail and Outlook, we always want the List-Unsubscribe header 
  // for maximum inbox placement according to modern provider guidelines.
  if (context.provider === 'GMAIL' || context.provider === 'OUTLOOK') {
    return { listUnsubscribeEnabled: true };
  }

  return { listUnsubscribeEnabled: false };
};


// -----------------------------------------------------------------------------
// Engine
// -----------------------------------------------------------------------------

// Rules are evaluated top-to-bottom.
const ACTIVE_RULES: DeliverabilityRule[] = [
  trackingOptimizationRule,
  listUnsubscribeRule,
];

/**
 * Evaluates the Smart Deliverability rules and returns a strictly immutable configuration decision.
 * 
 * @param context The current state/context of the email to be sent.
 * @returns DeliverabilityDecision (Immutable)
 */
export function evaluateDeliverability(context: DeliverabilityContext): DeliverabilityDecision {
  // If globally disabled, return the baseline defaults immediately.
  if (!context.isSmartDeliverabilityEnabled) {
    return DEFAULT_DECISION;
  }

  // Start with defaults, accumulate decisions from each rule.
  let accumulatedDecision: DeliverabilityDecision = { ...DEFAULT_DECISION };

  for (const rule of ACTIVE_RULES) {
    try {
      const overrides = rule(context, accumulatedDecision);
      accumulatedDecision = { ...accumulatedDecision, ...overrides };
    } catch (error) {
      // Safe fallback: Log error (if logging enabled) and continue execution
      // so a single bad rule never crashes the dispatch pipeline.
      if (process.env.DEBUG_DELIVERABILITY) {
        console.error('[SmartDeliverabilityEngine] Rule evaluation failed:', error);
      }
    }
  }

  // Freeze the final output to guarantee immutability for downstream consumers.
  return Object.freeze(accumulatedDecision);
}
