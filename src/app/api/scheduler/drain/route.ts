/**
 * API Route — POST /api/scheduler/drain
 *
 * Resets all PROCESSING steps back to PENDING.
 *
 * ⚠  DEVELOPMENT TOOL ONLY — BLOCKED IN PRODUCTION ⚠
 *
 * In production, resetting PROCESSING steps could cause duplicate email sends.
 * This endpoint is disabled when NODE_ENV !== 'development'.
 *
 * Phase 8 Hardening:
 *   - Returns 403 if NODE_ENV is not 'development'.
 *   - Only resets steps that have been PROCESSING for > STALE_THRESHOLD_MS.
 *   - Returns count of steps reset and their IDs for audit traceability.
 *
 * Phase 11 Security:
 *   - Requires SCHEDULER_SECRET in addition to the NODE_ENV guard.
 */

import { NextRequest, NextResponse } from "next/server";
import { drainProcessingSteps } from "@/lib/scheduler/claim";
import { verifySchedulerSecret, unauthorizedResponse } from "@/lib/auth/scheduler-auth";
import { logger } from "@/lib/observability/logger";
import { withObservability } from "@/lib/observability/middleware";

// Only allow drain in development
const ENVIRONMENT_GUARD = process.env.NODE_ENV;

export const POST = withObservability(async (request: NextRequest) => {
  // ── Authentication guard (checked before NODE_ENV guard) ──────────────────
  const auth = verifySchedulerSecret(request);
  if (!auth.authorized) return unauthorizedResponse(auth.reason);

  if (ENVIRONMENT_GUARD !== "development") {
    return NextResponse.json(
      {
        error: "FORBIDDEN",
        detail:
          "The drain endpoint is only available in development (NODE_ENV=development). " +
          "In production, reset stuck steps through the admin stale-step recovery workflow.",
      },
      { status: 403 }
    );
  }

  try {
    const reset = await drainProcessingSteps();
    return NextResponse.json({
      reset,
      message: `${reset} PROCESSING step${reset !== 1 ? "s" : ""} reset to PENDING.`,
      warning:
        "DEVELOPMENT ENDPOINT: This resets claimed steps. Only safe when Gmail sending is not actively running.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    logger.error("drain_failed", { detail: message, error });
    return NextResponse.json(
      { error: "Drain failed.", detail: message },
      { status: 500 }
    );
  }
});
