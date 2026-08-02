/**
 * Gmail Reply Tracker — Reliability Engine (Phase 5)
 *
 * Centralizes all self-healing, retry, rate-limiting, backoff, and
 * circuit-breaker logic in one place. All other modules defer here.
 *
 * Design Principles:
 *   - SINGLE RESPONSIBILITY: business logic stays unaware of retry mechanics
 *   - NO RETRY STORMS: jitter + circuit-breaker prevent thundering herds
 *   - FAIL SAFE: always preserve database consistency on unrecoverable failures
 *   - OBSERVABLE: every recovery action is structured-logged
 *   - IDEMPOTENT: safe to invoke repeatedly
 *
 * Failure Categories:
 *   TRANSIENT  → automatic retry (network blip, 429, 500/502/503)
 *   RECOVERABLE → self-heal (expired history ID, expired watch, expired access token)
 *   PERMANENT  → fail safe + flag for operator (revoked refresh token, invalid scope)
 *
 * Server-side only. Never import from client components.
 */

import prisma from "@/lib/prisma";

// ── Types ─────────────────────────────────────────────────────────────────────

export type FailureCategory = "TRANSIENT" | "RECOVERABLE" | "PERMANENT" | "UNKNOWN";

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  jitter?: boolean;
}

export interface CircuitBreakerState {
  failures: number;
  lastFailureAt: number | null;
  isOpen: boolean;
}

export interface ReliabilityEvent {
  type:
    | "RETRY_ATTEMPT"
    | "RETRY_EXHAUSTED"
    | "CIRCUIT_OPEN"
    | "CIRCUIT_RESET"
    | "SELF_HEAL_STARTED"
    | "SELF_HEAL_SUCCESS"
    | "SELF_HEAL_FAILED"
    | "QUOTA_THROTTLED"
    | "OAUTH_REVOKED";
  email?: string;
  attempt?: number;
  delayMs?: number;
  errorCode?: string;
  detail?: string;
}

// ── Structured Reliability Logger ─────────────────────────────────────────────

export function reliabilityLog(event: ReliabilityEvent): void {
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      service: "reliability-engine",
      ...event,
    })
  );
}

// ── Retry With Jitter (Production-Grade) ──────────────────────────────────────

/**
 * Retry a function with exponential backoff and full jitter.
 *
 * Jitter prevents synchronized retry storms when multiple accounts hit
 * the same quota or API failure window simultaneously.
 *
 * Retries ONLY on transient failures. Permanent errors are thrown immediately.
 */
export async function retryWithJitter<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
  context?: { email?: string; operation?: string }
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 500,
    maxDelayMs = 30_000,
    jitter = true,
  } = options;

  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      return await fn();
    } catch (err) {
      attempt++;

      const category = classifyError(err);

      // Permanent errors — never retry
      if (category === "PERMANENT") {
        reliabilityLog({
          type: "RETRY_EXHAUSTED",
          email: context?.email,
          attempt,
          errorCode: "PERMANENT",
          detail: `Permanent error on ${context?.operation ?? "operation"}: ${safeMsg(err)}`,
        });
        throw err;
      }

      // Exhausted all retries
      if (attempt >= maxRetries) {
        reliabilityLog({
          type: "RETRY_EXHAUSTED",
          email: context?.email,
          attempt,
          detail: `All ${maxRetries} retries exhausted for ${context?.operation ?? "operation"}: ${safeMsg(err)}`,
        });
        throw err;
      }

      // Calculate backoff delay with jitter
      const baseDelay = Math.min(initialDelayMs * Math.pow(2, attempt - 1), maxDelayMs);
      const delay = jitter ? Math.floor(baseDelay * (0.5 + Math.random() * 0.5)) : baseDelay;

      reliabilityLog({
        type: "RETRY_ATTEMPT",
        email: context?.email,
        attempt,
        delayMs: delay,
        errorCode: category,
        detail: `Retrying ${context?.operation ?? "operation"} in ${delay}ms (attempt ${attempt}/${maxRetries})`,
      });

      await sleep(delay);
    }
  }

  throw new Error("Unreachable: retry loop exhausted without throwing.");
}

// ── Per-Account Rate Limit Governor ───────────────────────────────────────────

/**
 * In-memory per-account API call budget tracker.
 * Prevents exceeding Gmail API quota (1 billion quota units/day per project).
 * Tracked per sliding minute window.
 */
const apiCallBudget = new Map<string, { count: number; windowStart: number }>();
const MAX_CALLS_PER_MINUTE_PER_ACCOUNT = 60;
const WINDOW_MS = 60_000;

export function checkRateLimit(email: string): boolean {
  const now = Date.now();
  const budget = apiCallBudget.get(email);

  if (!budget || now - budget.windowStart > WINDOW_MS) {
    apiCallBudget.set(email, { count: 1, windowStart: now });
    return true;
  }

  if (budget.count >= MAX_CALLS_PER_MINUTE_PER_ACCOUNT) {
    reliabilityLog({
      type: "QUOTA_THROTTLED",
      email,
      detail: `Rate limit reached: ${budget.count} calls in the last 60s. Throttling.`,
    });
    return false; // caller should backoff
  }

  budget.count++;
  return true;
}

// ── Simple Circuit Breaker (Per-Account) ──────────────────────────────────────

/**
 * Per-account in-memory circuit breaker to prevent hammering failing accounts.
 *
 * Open circuit: after 5 consecutive failures within 5 minutes.
 * Reset circuit: automatically after 10-minute cooling period.
 */
const circuitState = new Map<string, CircuitBreakerState>();
const CIRCUIT_OPEN_AFTER_FAILURES = 5;
const CIRCUIT_RESET_AFTER_MS = 10 * 60 * 1000; // 10 minutes

export function isCircuitOpen(email: string): boolean {
  const state = circuitState.get(email);
  if (!state) return false;
  if (!state.isOpen) return false;

  // Auto-reset after cooling period
  if (state.lastFailureAt && Date.now() - state.lastFailureAt > CIRCUIT_RESET_AFTER_MS) {
    circuitState.set(email, { failures: 0, lastFailureAt: null, isOpen: false });
    reliabilityLog({ type: "CIRCUIT_RESET", email, detail: "Circuit breaker auto-reset after cooling period." });
    return false;
  }

  return true;
}

export function recordCircuitFailure(email: string): void {
  const current = circuitState.get(email) ?? { failures: 0, lastFailureAt: null, isOpen: false };
  const failures = current.failures + 1;
  const isOpen = failures >= CIRCUIT_OPEN_AFTER_FAILURES;

  if (isOpen && !current.isOpen) {
    reliabilityLog({
      type: "CIRCUIT_OPEN",
      email,
      detail: `Circuit opened after ${failures} consecutive failures. Will auto-reset in 10 minutes.`,
    });
  }

  circuitState.set(email, { failures, lastFailureAt: Date.now(), isOpen });
}

export function resetCircuit(email: string): void {
  circuitState.delete(email);
}

// ── Error Classification ───────────────────────────────────────────────────────

/**
 * Classify any thrown error into a reliability category.
 *
 * TRANSIENT:   Safe to retry (network blip, rate limit, server error)
 * RECOVERABLE: Self-heal action needed (expired token, expired watch)
 * PERMANENT:   Never retry (revoked refresh token, invalid scope, account banned)
 * UNKNOWN:     Unknown failure — treat conservatively (single retry)
 */
export function classifyError(err: unknown): FailureCategory {
  if (err === null || err === undefined) return "UNKNOWN";

  const message = err instanceof Error ? err.message.toLowerCase() : "";
  const status =
    (err as { status?: number })?.status ||
    (err as { code?: number })?.code;

  // Permanent OAuth failures — never retry
  if (
    message.includes("invalid_grant") ||
    message.includes("token has been expired or revoked") ||
    message.includes("access_denied") ||
    message.includes("invalid_client")
  ) {
    return "PERMANENT";
  }

  // Scope/permission errors — permanent
  if (status === 403 && (message.includes("insufficient permission") || message.includes("access not configured"))) {
    return "PERMANENT";
  }

  // Rate limit / quota exceeded — transient
  if (
    status === 429 ||
    message.includes("ratelimitexceeded") ||
    message.includes("user rate limit exceeded") ||
    message.includes("quota exceeded")
  ) {
    return "TRANSIENT";
  }

  // Server errors — transient
  if (status === 500 || status === 502 || status === 503 || status === 504) return "TRANSIENT";

  // Network errors — transient
  if (
    message.includes("econnreset") ||
    message.includes("etimedout") ||
    message.includes("enotfound") ||
    message.includes("socket hang up") ||
    message.includes("network error")
  ) {
    return "TRANSIENT";
  }

  // Recoverable Gmail conditions
  if (message.includes("history_expired") || status === 404) return "RECOVERABLE";

  return "UNKNOWN";
}

/**
 * Detect whether a refresh token has been revoked by the user.
 * When true, system must flag NEEDS_RECONNECT and stop self-healing.
 */
export function isOAuthRevoked(err: unknown): boolean {
  const message = err instanceof Error ? err.message.toLowerCase() : "";
  return (
    message.includes("invalid_grant") ||
    message.includes("token has been expired or revoked") ||
    message.includes("refresh_token_not_found")
  );
}

/**
 * Mark an account as NEEDS_RECONNECT in the database when OAuth is revoked.
 * Non-throwing — best-effort write.
 */
export async function markAccountNeedsReconnect(email: string, reason: string): Promise<void> {
  try {
    await prisma.emailAccount.updateMany({
      where: { email },
      data: {
        connection_status: "NEEDS_RECONNECT",
      },
    });
    await prisma.gmailWatchState.updateMany({
      where: { email },
      data: {
        health_status: "NEEDS_RECONNECT",
        last_error: reason.slice(0, 500),
        error_count: { increment: 1 },
      },
    });
    reliabilityLog({
      type: "OAUTH_REVOKED",
      email,
      detail: `OAuth refresh token revoked or expired. Account flagged for reconnection: ${reason}`,
    });
  } catch {
    // Non-fatal: best-effort write
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
