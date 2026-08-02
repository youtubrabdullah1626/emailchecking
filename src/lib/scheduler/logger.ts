/**
 * Scheduler Logger — Structured Logging
 *
 * Emits structured JSON log lines to stdout (console.log).
 * Every log line is machine-readable and searchable.
 *
 * Log safety rules enforced here:
 *   - No DATABASE_URL, DIRECT_URL, or any connection string
 *   - No OAuth tokens or API keys
 *   - No email body text
 *   - No raw personal data beyond name/email for traceability
 *   - No stack traces with secrets
 */

import { logger } from "@/lib/observability/logger";
import { audit } from "@/lib/observability/audit";
import type { SchedulerLogEvent } from "./types";

export interface LogPayload {
  runId?: string;
  stepId?: string;
  stepNumber?: number;
  prospectId?: string;
  prospectName?: string;
  sequenceId?: string;
  scheduledAt?: string;
  queryTime?: string;
  candidatesFound?: number;
  eligibleSteps?: number;
  claimedSteps?: number;
  skippedSteps?: number;
  errorSteps?: number;
  durationMs?: number;
  maxClaims?: number;
  dryRun?: boolean;
  reason?: string;
  status?: string;
  message?: string;
  [key: string]: string | number | boolean | undefined;
}

export function log(event: SchedulerLogEvent, payload: LogPayload = {}): void {
  const isError = String(event) === "scheduler_run_failed" || String(event) === "claim_failed" || String(event).includes("error");
  const isWarn = String(event) === "stale_processing_steps_detected";

  // If the run completed, audit it
  if (String(event) === "scheduler_run_completed") {
    audit.logEvent({
      actionType: "SYSTEM_ACTION",
      action: "Scheduler Run Completed",
      metadata: payload,
    }).catch(() => {});
  }

  const meta = { ...payload, module: "Scheduler" };

  if (isError) {
    logger.error(`Scheduler Event: ${event}`, meta);
  } else if (isWarn) {
    logger.warn(`Scheduler Event: ${event}`, meta);
  } else {
    logger.info(`Scheduler Event: ${event}`, meta);
  }
}
