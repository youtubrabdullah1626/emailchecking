/**
 * State Machine Enforcement — Phase 8
 *
 * Pure deterministic functions that validate legal state transitions.
 * Illegal transitions are rejected before any database write.
 *
 * Transition Model:
 *
 * Sequence:
 *   DRAFT     → ACTIVE
 *   ACTIVE    → STOPPED
 *   ACTIVE    → COMPLETED
 *   DRAFT / STOPPED / COMPLETED → (terminal — no transitions)
 *
 * Step:
 *   PENDING     → PROCESSING   (scheduler atomic claim)
 *   PROCESSING  → SENT         (Gmail send success)
 *   PROCESSING  → FAILED       (Gmail send failure)
 *   PENDING     → CANCELLED    (reply stop action)
 *   PROCESSING  → CANCELLED    (reply stop action)
 *   PENDING     → SKIPPED      (step disabled before sequence start)
 *
 * TERMINAL step states: SENT, FAILED, SKIPPED, CANCELLED
 * Terminal states cannot transition to anything.
 *
 * Server-side only. Pure functions — no database access.
 */

export interface TransitionResult {
  valid: boolean;
  reason: string;
}

// ── Sequence State Machine ────────────────────────────────────────────────────

const LEGAL_SEQUENCE_TRANSITIONS: Record<string, string[]> = {
  DRAFT:     ["ACTIVE"],
  ACTIVE:    ["STOPPED", "COMPLETED"],
  STOPPED:   [], // terminal
  COMPLETED: [], // terminal
};

/**
 * Validates a sequence status transition.
 * Returns { valid: true } for legal transitions, { valid: false, reason } for illegal.
 */
export function validateSequenceTransition(
  from: string,
  to: string
): TransitionResult {
  const allowed = LEGAL_SEQUENCE_TRANSITIONS[from];

  if (allowed === undefined) {
    return {
      valid: false,
      reason: `Unknown sequence status "${from}". Cannot determine valid transitions.`,
    };
  }

  if (from === to) {
    return {
      valid: false,
      reason: `Sequence is already in status "${from}". No transition needed.`,
    };
  }

  if (!allowed.includes(to)) {
    if (allowed.length === 0) {
      return {
        valid: false,
        reason: `Sequence status "${from}" is terminal. No further transitions are allowed.`,
      };
    }
    return {
      valid: false,
      reason: `Illegal sequence transition: "${from}" → "${to}". Allowed from "${from}": [${allowed.join(", ")}].`,
    };
  }

  return {
    valid: true,
    reason: `Sequence transition "${from}" → "${to}" is valid.`,
  };
}

// ── Step State Machine ────────────────────────────────────────────────────────

const LEGAL_STEP_TRANSITIONS: Record<string, string[]> = {
  PENDING:    ["PROCESSING", "CANCELLED", "SKIPPED"],
  PROCESSING: ["SENT", "FAILED", "CANCELLED"],
  SENT:       [], // terminal
  FAILED:     [], // terminal (manual reset allowed via dedicated admin action)
  SKIPPED:    [], // terminal
  CANCELLED:  [], // terminal
};

/**
 * Validates a step status transition.
 * Returns { valid: true } for legal transitions, { valid: false, reason } for illegal.
 */
export function validateStepTransition(
  from: string,
  to: string
): TransitionResult {
  const allowed = LEGAL_STEP_TRANSITIONS[from];

  if (allowed === undefined) {
    return {
      valid: false,
      reason: `Unknown step status "${from}". Cannot determine valid transitions.`,
    };
  }

  if (from === to) {
    return {
      valid: false,
      reason: `Step is already in status "${from}". No transition needed.`,
    };
  }

  if (!allowed.includes(to)) {
    if (allowed.length === 0) {
      return {
        valid: false,
        reason: `Step status "${from}" is terminal. No further transitions are allowed. Terminal states: SENT, FAILED, SKIPPED, CANCELLED.`,
      };
    }
    return {
      valid: false,
      reason: `Illegal step transition: "${from}" → "${to}". Allowed from "${from}": [${allowed.join(", ")}].`,
    };
  }

  return {
    valid: true,
    reason: `Step transition "${from}" → "${to}" is valid.`,
  };
}

/**
 * Returns true if a step status is terminal (cannot be transitioned from).
 */
export function isTerminalStepStatus(status: string): boolean {
  const transitions = LEGAL_STEP_TRANSITIONS[status];
  return transitions !== undefined && transitions.length === 0;
}

/**
 * Returns true if a sequence status is terminal (cannot be transitioned from).
 */
export function isTerminalSequenceStatus(status: string): boolean {
  const transitions = LEGAL_SEQUENCE_TRANSITIONS[status];
  return transitions !== undefined && transitions.length === 0;
}
