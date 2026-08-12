/**
 * Scheduler Run — Full Orchestration
 *
 * Executes one complete scheduler run:
 *
 *   1. Generate a unique run ID
 *   2. Query the DB for candidate steps (PENDING, due, ACTIVE sequence+prospect)
 *   3. Re-validate each candidate's eligibility (guards against race windows)
 *   4. Atomically claim each eligible step (PENDING → PROCESSING)
 *   5. Collect claimed step IDs for the Phase 5 Gmail sender
 *   6. Return a structured SchedulerRunResult
 *
 * This function does NOT send any emails.
 * It does NOT interact with Gmail or any external API.
 * It does NOT perform timezone calculations (scheduled_at_utc is authoritative).
 *
 * Server-side only.
 */

import { randomUUID } from "crypto";
import { findCandidateSteps, findStaleProcessingSteps } from "./query";
import { isStepFullyEligible } from "./eligibility";
import { claimStep } from "./claim";
import { log } from "./logger";
import prisma from "@/lib/prisma";
import type {
  SchedulerRunOptions,
  SchedulerRunResult,
  SchedulerRunStatus,
  StaleStepInfo,
} from "./types";

// Default limits
const DEFAULT_MAX_CLAIMS = 50;

/**
 * Run the scheduler.
 *
 * @param options.dryRun   — if true, identify eligible steps without claiming (default: false)
 * @param options.maxClaims — maximum steps to claim per run (default: 50)
 */
export async function runScheduler(
  options: SchedulerRunOptions = {}
): Promise<SchedulerRunResult> {
  let { dryRun = false, maxClaims = DEFAULT_MAX_CLAIMS } = options;
  const runId = randomUUID();
  const startedAt = new Date();

  log("scheduler_run_started", {
    runId,
    dryRun,
    maxClaims,
    startedAt: startedAt.toISOString(),
  });

  // Counters
  let candidatesFound = 0;
  let eligibleSteps = 0;
  let claimedSteps = 0;
  let skippedSteps = 0;
  let errorSteps = 0;
  const claimedStepIds: string[] = [];
  const errors: string[] = [];
  let staleProcessingSteps: StaleStepInfo[] = [];

  // ── Capacity Enforcement (Hourly & Daily Limits) ──────────────────────────
  try {
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);

    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);

    const [
      dailyLimitConfig,
      hourlyLimitConfig,
      emailsSentThisHour,
      emailsSentToday,
    ] = await Promise.all([
      prisma.platform_configs.findFirst({ where: { key: "MAX_DAILY_EMAILS" } }),
      prisma.platform_configs.findFirst({ where: { key: "HOURLY_EMAIL_LIMIT" } }),
      prisma.emailEvent.count({ where: { event_type: "SENT", occurred_at: { gte: oneHourAgo } } }),
      prisma.emailEvent.count({ where: { event_type: "SENT", occurred_at: { gte: startOfDay } } }),
    ]);

    const maxDaily = dailyLimitConfig?.value ? parseInt(String(dailyLimitConfig.value), 10) : 500;
    const maxHourly = hourlyLimitConfig?.value ? parseInt(String(hourlyLimitConfig.value), 10) : 50;

    const availableDaily = Math.max(0, maxDaily - emailsSentToday);
    const availableHourly = Math.max(0, maxHourly - emailsSentThisHour);

    const dynamicMaxClaims = Math.min(availableDaily, availableHourly, maxClaims);

    if (dynamicMaxClaims <= 0) {
      log("scheduler_skipped_due_to_limits", {
        runId,
        availableDaily,
        availableHourly,
        emailsSentToday,
        emailsSentThisHour
      });
      return {
        runId,
        startedAt: startedAt.toISOString(),
        finishedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt.getTime(),
        candidatesFound: 0,
        eligibleSteps: 0,
        claimedSteps: 0,
        skippedSteps: 0,
        errorSteps: 0,
        errors: [],
        claimedStepIds: [],
        dryRun,
        status: "SUCCESS", // Or SKIPPED, but SUCCESS avoids alerting
        staleProcessingSteps: [],
      };
    }
    
    // Override maxClaims for this run based on available capacity
    maxClaims = dynamicMaxClaims;
  } catch (err) {
    log("scheduler_limit_check_failed", { runId, error: String(err) });
    // If limits check fails, continue with default maxClaims to avoid halting completely
  }

  try {
    // ── Step 1: query candidates ──────────────────────────────────────────────
    const nowUtc = new Date(); // single reference time for the whole run
    const candidates = await findCandidateSteps(nowUtc, maxClaims);
    candidatesFound = candidates.length;

    // ── Phase 8: Observe stale PROCESSING steps ───────────────────────────────
    // Stale steps are PROCESSING but have not advanced — likely a stuck process.
    // These are logged as a WARNING for observability but NEVER auto-reset.
    staleProcessingSteps = await findStaleProcessingSteps(nowUtc);
    if (staleProcessingSteps.length > 0) {
      log("stale_processing_steps_detected", {
        runId,
        count: staleProcessingSteps.length,
        // Log IDs as comma-separated string (LogPayload only allows primitives)
        stepIds: staleProcessingSteps.map((s) => s.stepId).join(","),
        warning:
          "These steps are stuck in PROCESSING. Manual investigation required. " +
          "Do NOT auto-reset without verifying no email was delivered.",
      });
    }

    log("candidates_found", {
      runId,
      candidatesFound,
      queryTime: nowUtc.toISOString(),
    });

    // ── Step 2: process each candidate ───────────────────────────────────────
    for (const step of candidates) {
      const eligibility = isStepFullyEligible(
        {
          status: step.status,
          scheduled_at_utc: step.scheduled_at_utc,
        },
        { status: step.sequence.status },
        { status: step.sequence.prospect.status },
        nowUtc
      );

      if (!eligibility.eligible) {
        // Should be rare — the DB query pre-filters — but this guards the race window
        log("step_not_eligible", {
          runId,
          stepId: step.id,
          stepNumber: step.step_number,
          sequenceId: step.sequence.id,
          prospectId: step.sequence.prospect.id,
          reason: eligibility.reason,
          status: step.status,
        });
        skippedSteps++;
        continue;
      }

      log("step_eligible", {
        runId,
        stepId: step.id,
        stepNumber: step.step_number,
        sequenceId: step.sequence.id,
        prospectId: step.sequence.prospect.id,
        prospectName: step.sequence.prospect.name,
        scheduledAt: step.scheduled_at_utc.toISOString(),
        dryRun,
      });

      eligibleSteps++;

      if (dryRun) {
        // In dry-run mode: count as "would be claimed" without state change
        claimedSteps++;
        claimedStepIds.push(step.id);
        continue;
      }

      // ── Step 3: attempt atomic claim ──────────────────────────────────────
      const claimResult = await claimStep(step.id, runId);

      switch (claimResult.outcome) {
        case "CLAIMED":
          claimedSteps++;
          claimedStepIds.push(step.id);
          log("step_claimed", {
            runId,
            stepId: step.id,
            stepNumber: step.step_number,
            sequenceId: step.sequence.id,
            prospectId: step.sequence.prospect.id,
            prospectName: step.sequence.prospect.name,
            scheduledAt: step.scheduled_at_utc.toISOString(),
          });
          break;

        case "ALREADY_TAKEN":
          skippedSteps++;
          log("step_already_taken", {
            runId,
            stepId: step.id,
            reason: "Another scheduler run claimed this step first (race condition).",
          });
          break;

        case "ERROR":
          errorSteps++;
          const errMsg = claimResult.error ?? "Unknown claim error";
          errors.push(`Step ${step.id}: ${errMsg}`);
          log("step_claim_error", {
            runId,
            stepId: step.id,
            message: errMsg,
          });
          break;
      }
    }

    // ── Step 4: build result ──────────────────────────────────────────────────
    const finishedAt = new Date();
    const durationMs = finishedAt.getTime() - startedAt.getTime();

    const status: SchedulerRunStatus =
      errorSteps === 0
        ? "SUCCESS"
        : errorSteps < candidatesFound
        ? "PARTIAL_FAILURE"
        : "FAILED";

    const result: SchedulerRunResult = {
      runId,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs,
      candidatesFound,
      eligibleSteps,
      claimedSteps,
      skippedSteps,
      errorSteps,
      errors,
      claimedStepIds,
      dryRun,
      status,
      staleProcessingSteps,
    };

    log("scheduler_run_completed", {
      runId,
      candidatesFound,
      eligibleSteps,
      claimedSteps,
      skippedSteps,
      errorSteps,
      durationMs,
      dryRun,
      status,
    });

    return result;
  } catch (error) {
    const finishedAt = new Date();
    const message =
      error instanceof Error ? error.message : "Unknown scheduler error";

    log("scheduler_run_failed", {
      runId,
      message,
      durationMs: finishedAt.getTime() - startedAt.getTime(),
    });

    return {
      runId,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      candidatesFound,
      eligibleSteps,
      claimedSteps,
      skippedSteps,
      errorSteps: errorSteps + 1,
      errors: [...errors, `Fatal scheduler error: ${message}`],
      claimedStepIds,
      dryRun,
      status: "FAILED",
      staleProcessingSteps,
    };
  }
}
