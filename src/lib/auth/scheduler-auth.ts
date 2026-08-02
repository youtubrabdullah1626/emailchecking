/**
 * Scheduler Authentication — Production API Secret Guard
 *
 * Protects all operational endpoints that can mutate system state or
 * trigger background work (scheduler, Gmail send, reply scan).
 *
 * Authentication method:
 *   - HTTP header: Authorization: Bearer <SCHEDULER_SECRET>
 *   - Fallback header: x-scheduler-secret: <SCHEDULER_SECRET>
 *
 * Security properties:
 *   - Constant-time comparison (prevents timing attacks)
 *   - Never logs or exposes the secret or any partial secret
 *   - In development mode (NODE_ENV=development) with no secret configured:
 *     allows through with a structured warning log
 *   - In production: any request without a valid secret is rejected with 401
 *
 * Usage:
 *   const auth = verifySchedulerSecret(request);
 *   if (!auth.authorized) return authErrorResponse(auth.reason);
 *
 * Server-side only. Never import from client components.
 */

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual, createHash } from "crypto";

export interface AuthResult {
  authorized: boolean;
  reason: string;
}

// ── Constant-time string comparison ─────────────────────────────────────────

/**
 * Compare two strings in constant time.
 * Uses a fixed-length SHA-256 hash to ensure equal-length comparison
 * regardless of input length, preventing length-based timing leaks.
 */
function constantTimeEqual(a: string, b: string): boolean {
  const hashA = createHash("sha256").update(a).digest();
  const hashB = createHash("sha256").update(b).digest();
  return timingSafeEqual(hashA, hashB);
}

// ── Auth log (never logs secret values) ──────────────────────────────────────

interface AuthLogPayload {
  event: string;
  endpoint?: string;
  reason?: string;
  requestId?: string;
}

function authLog(payload: AuthLogPayload): void {
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      ...payload,
    })
  );
}

// ── Main verification function ────────────────────────────────────────────────

/**
 * Verify the scheduler secret on an incoming request.
 *
 * @param request — the incoming Next.js request
 * @returns AuthResult — { authorized: boolean, reason: string }
 */
export function verifySchedulerSecret(request: NextRequest): AuthResult {
  const secret = process.env.SCHEDULER_SECRET;
  const isDevelopment = process.env.NODE_ENV === "development";
  const endpoint = request.nextUrl.pathname;

  // ── Development convenience passthrough ───────────────────────────────────
  // If no secret is configured in development, allow through with a warning.
  // This preserves developer convenience without weakening production security.
  if (!secret) {
    if (isDevelopment) {
      authLog({
        event: "auth_dev_passthrough",
        endpoint,
        reason:
          "SCHEDULER_SECRET not set in development mode — request allowed. " +
          "Set SCHEDULER_SECRET in .env.local before deploying to production.",
      });
      return { authorized: true, reason: "Development passthrough (no secret configured)" };
    }

    // Production with no secret — this is a misconfiguration, reject with 401
    authLog({
      event: "auth_configuration_error",
      endpoint,
      reason: "SCHEDULER_SECRET is not set in production environment.",
    });
    return {
      authorized: false,
      reason: "Server configuration error: authentication is not configured.",
    };
  }

  // ── Extract the provided secret from request headers ─────────────────────
  // Support two header formats for compatibility with cron services
  const authHeader = request.headers.get("authorization");
  const xSchedulerSecret = request.headers.get("x-scheduler-secret");

  let providedSecret: string | null = null;

  if (authHeader) {
    // Expect: "Bearer <secret>"
    const parts = authHeader.split(" ");
    if (parts.length === 2 && parts[0].toLowerCase() === "bearer") {
      providedSecret = parts[1];
    }
  } else if (xSchedulerSecret) {
    providedSecret = xSchedulerSecret;
  }

  if (!providedSecret) {
    authLog({
      event: "auth_missing_credentials",
      endpoint,
      reason: "No Authorization or x-scheduler-secret header provided.",
    });
    return {
      authorized: false,
      reason: "Missing credentials. Provide 'Authorization: Bearer <secret>' header.",
    };
  }

  // ── Constant-time comparison ──────────────────────────────────────────────
  const valid = constantTimeEqual(providedSecret, secret);

  if (!valid) {
    authLog({
      event: "auth_invalid_secret",
      endpoint,
      reason: "Provided secret did not match SCHEDULER_SECRET.",
    });
    return { authorized: false, reason: "Invalid credentials." };
  }

  return { authorized: true, reason: "Authorized." };
}

// ── Standard error responses ──────────────────────────────────────────────────

/**
 * Return a structured 401 Unauthorized response.
 * Safe for external callers — never reveals internal details.
 */
export function unauthorizedResponse(reason: string): NextResponse {
  return NextResponse.json(
    {
      error: "UNAUTHORIZED",
      detail: reason,
    },
    { status: 401 }
  );
}
