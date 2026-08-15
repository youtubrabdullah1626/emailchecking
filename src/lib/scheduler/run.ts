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
import { getStartOfDayInTimezone, getStartOfHour } from "@/lib/date-utils";
import type {
  SchedulerRunOptions,
  SchedulerRunResult,
  SchedulerRunStatus,
  StaleStepInfo,
} from "./types";

// Default limits
const DEFAULT_MAX_CLAIMS = 50;

interface UserCapacityState {
  timezone: string;
  dailyLimit: number;
  hourlyLimit: number;
  claimedThisRun: number;
  sentToday: number;
  sentThisHour: number;
  sentLast24h: number;
}

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

  // Fetch dynamic platform limit configs
  let maxDaily = 500;
  let maxHourly = 50;
  try {
    const [dailyLimitConfig, hourlyLimitConfig] = await Promise.all([
      prisma.platform_configs.findFirst({ where: { key: "MAX_DAILY_EMAILS" } }),
      prisma.platform_configs.findFirst({ where: { key: "HOURLY_EMAIL_LIMIT" } }),
    ]);
    if (dailyLimitConfig?.value) maxDaily = parseInt(String(dailyLimitConfig.value), 10);
    if (hourlyLimitConfig?.value) maxHourly = parseInt(String(hourlyLimitConfig.value), 10);
  } catch (err) {
    log("scheduler_config_fetch_warning", { runId, error: String(err) });
  }

  // Multi-tenant per-user capacity cache for this run
  const userCapacityCache = new Map<string, UserCapacityState>();

  async function getUserCapacity(userId: string, now: Date): Promise<UserCapacityState> {
    const cached = userCapacityCache.get(userId);
    if (cached) return cached;

    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });
    const tz = user?.timezone || "UTC";
    const startOfDay = getStartOfDayInTimezone(tz, now);
    const startOfHour = getStartOfHour(now);
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [sentToday, sentThisHour, sentLast24h, userInboxes] = await Promise.all([
      prisma.emailEvent.count({
        where: {
          event_type: "SENT",
          occurred_at: { gte: startOfDay },
          step: { sequence: { user_id: userId } },
        },
      }),
      prisma.emailEvent.count({
        where: {
          event_type: "SENT",
          occurred_at: { gte: startOfHour },
          step: { sequence: { user_id: userId } },
        },
      }),
      prisma.emailEvent.count({
        where: {
          event_type: "SENT",
          occurred_at: { gte: twentyFourHoursAgo },
          step: { sequence: { user_id: userId } },
        },
      }),
      prisma.emailAccount.findMany({
        where: { user_id: userId, connection_status: "CONNECTED" },
        select: { created_at: true, warmup_status: true, daily_limit: true },
      }),
    ]);

    let dynamicUserDailyLimit = 0;
    if (userInboxes && userInboxes.length > 0) {
      for (const acc of userInboxes) {
        const created = acc.created_at || now;
        const ageInDays = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
        const baseLimit = acc.daily_limit && acc.daily_limit <= 100 ? acc.daily_limit : 50;
        if (acc.warmup_status === "COMPLETED" || ageInDays >= 7) {
          dynamicUserDailyLimit += baseLimit;
        } else if (ageInDays <= 2) {
          dynamicUserDailyLimit += Math.min(baseLimit, 10);
        } else {
          dynamicUserDailyLimit += Math.min(baseLimit, 25);
        }
      }
    } else {
      dynamicUserDailyLimit = maxDaily;
    }

    const state: UserCapacityState = {
      timezone: tz,
      dailyLimit: dynamicUserDailyLimit,
      hourlyLimit: userInboxes && userInboxes.length > 0 ? userInboxes.length * 15 : maxHourly,
      claimedThisRun: 0,
      sentToday,
      sentThisHour,
      sentLast24h,
    };
    userCapacityCache.set(userId, state);
    return state;
  }

  try {
    // ── Step 1: query candidates ──────────────────────────────────────────────
    const nowUtc = new Date(); // single reference time for the whole run
    const candidates = await findCandidateSteps(nowUtc, maxClaims);
    candidatesFound = candidates.length;

    // ── Phase 8: Observe stale PROCESSING steps ───────────────────────────────
    staleProcessingSteps = await findStaleProcessingSteps(nowUtc);
    if (staleProcessingSteps.length > 0) {
      log("stale_processing_steps_detected", {
        runId,
        count: staleProcessingSteps.length,
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

      // Multi-Tenant Isolation Check: Enforce per-user daily, hourly, & 24h capacity
      if (step.sequence.user_id) {
        const userCap = await getUserCapacity(step.sequence.user_id, nowUtc);
        const effectiveDaily = Math.max(userCap.sentToday, userCap.sentLast24h) + userCap.claimedThisRun;
        const effectiveHourly = userCap.sentThisHour + userCap.claimedThisRun;

        if (effectiveDaily >= userCap.dailyLimit || effectiveHourly >= userCap.hourlyLimit) {
          log("step_skipped_user_capacity_exhausted", {
            runId,
            stepId: step.id,
            userId: step.sequence.user_id,
            effectiveDaily,
            dailyLimit: userCap.dailyLimit,
            effectiveHourly,
            hourlyLimit: userCap.hourlyLimit,
          });
          skippedSteps++;
          continue;
        }
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
        if (step.sequence.user_id) {
          const userCap = userCapacityCache.get(step.sequence.user_id);
          if (userCap) userCap.claimedThisRun++;
        }
        continue;
      }

      // ── Step 3: attempt atomic claim ──────────────────────────────────────
      const claimResult = await claimStep(step.id, runId);

      switch (claimResult.outcome) {
        case "CLAIMED":
          claimedSteps++;
          claimedStepIds.push(step.id);
          if (step.sequence.user_id) {
            const userCap = userCapacityCache.get(step.sequence.user_id);
            if (userCap) userCap.claimedThisRun++;
          }
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
