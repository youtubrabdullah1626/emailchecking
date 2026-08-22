/**
 * Scheduler Run -- Full Orchestration (LBJD v3 Simplified)
 *
 * Phase 0: Background maintenance (stale monitor, retryable reset, self-healing sweeper)
 * Phase 1: Query eligible candidates (uses eligible_after_utc for late-binding dispatch)
 * Phase 2: Tier classification + waterfall capacity allocation + fairness sort
 * Phase 3: Per-candidate eligibility re-check, capacity gate, atomic claim
 * Phase 4: Return structured SchedulerRunResult
 *
 * Server-side only.
 */

import { randomUUID } from "crypto";
import { findCandidateSteps, findStaleProcessingSteps } from "./query";
import { runStaleMonitor, runSelfHealingSweeper, runRetryableReset } from "./reconciler";
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

export async function runScheduler(
  options: SchedulerRunOptions = {}
): Promise<SchedulerRunResult> {
  let { dryRun = false, maxClaims = DEFAULT_MAX_CLAIMS } = options;
  const runId = randomUUID();
  const startedAt = new Date();

  log("scheduler_run_started", { runId, dryRun, maxClaims, startedAt: startedAt.toISOString() });

  let candidatesFound = 0;
  let eligibleSteps = 0;
  let claimedSteps = 0;
  let skippedSteps = 0;
  let errorSteps = 0;
  const claimedStepIds: string[] = [];
  const errors: string[] = [];
  let staleProcessingSteps: StaleStepInfo[] = [];
  let lockAcquired = false;

  let maxDaily = 500;
  let maxHourly = 50;
  try {
    const [d, h] = await Promise.all([
      prisma.platform_configs.findFirst({ where: { key: "MAX_DAILY_EMAILS" } }),
      prisma.platform_configs.findFirst({ where: { key: "HOURLY_EMAIL_LIMIT" } }),
    ]);
    if (d?.value) maxDaily = parseInt(String(d.value), 10);
    if (h?.value) maxHourly = parseInt(String(h.value), 10);
  } catch (err) {
    log("scheduler_config_fetch_warning", { runId, error: String(err) });
  }

  const userCapacityCache = new Map<string, UserCapacityState>();

  async function getUserCapacity(userId: string, now: Date): Promise<UserCapacityState> {
    const cached = userCapacityCache.get(userId);
    if (cached) return cached;

    const user = await prisma.users.findUnique({ where: { id: userId }, select: { timezone: true } });
    const tz = user?.timezone || "UTC";
    const startOfDay = getStartOfDayInTimezone(tz, now);
    const startOfHour = getStartOfHour(now);
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [sentToday, sentThisHour, sentLast24h, userInboxes] = await Promise.all([
      prisma.emailEvent.count({ where: { event_type: "SENT", occurred_at: { gte: startOfDay }, step: { sequence: { user_id: userId } } } }),
      prisma.emailEvent.count({ where: { event_type: "SENT", occurred_at: { gte: startOfHour }, step: { sequence: { user_id: userId } } } }),
      prisma.emailEvent.count({ where: { event_type: "SENT", occurred_at: { gte: twentyFourHoursAgo }, step: { sequence: { user_id: userId } } } }),
      prisma.emailAccount.findMany({ where: { user_id: userId, connection_status: "CONNECTED" }, select: { created_at: true, warmup_status: true, daily_limit: true } }),
    ]);

    let dynamicUserDailyLimit = 0;
    const defaultPerInbox = (maxDaily && maxDaily > 0) ? maxDaily : 50;
    if (userInboxes && userInboxes.length > 0) {
      for (const acc of userInboxes) {
        const baseLimit = (acc.daily_limit && acc.daily_limit > 0) ? acc.daily_limit : defaultPerInbox;
        dynamicUserDailyLimit += baseLimit;
      }
    } else {
      dynamicUserDailyLimit = defaultPerInbox;
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
    const SCHEDULER_LOCK_KEY = 'main_scheduler';
    lockAcquired = true;
    try {
      const lockResult = await prisma.$executeRaw`
        INSERT INTO scheduler_locks (lock_name, locked_at, locked_until, run_id)
        VALUES (${SCHEDULER_LOCK_KEY}, NOW(), NOW() + INTERVAL '15 seconds', ${runId})
        ON CONFLICT (lock_name) DO UPDATE
          SET locked_at = NOW(), locked_until = NOW() + INTERVAL '15 seconds', run_id = ${runId}
          WHERE scheduler_locks.locked_until < NOW()
      `;
      if (lockResult === 0) {
        lockAcquired = false;
      }
    } catch (lockErr) {
      log("scheduler_config_fetch_warning", { runId, error: String(lockErr) });
    }

    if (!lockAcquired) {
      console.log('scheduler_run_skipped_lock_held', { runId });
      return { runId, startedAt: startedAt.toISOString(), finishedAt: new Date().toISOString(), durationMs: 0, candidatesFound: 0, eligibleSteps: 0, claimedSteps: 0, skippedSteps: 0, errorSteps: 0, errors: [], claimedStepIds: [], dryRun, status: 'SUCCESS' as SchedulerRunStatus, staleProcessingSteps: [] };
    }

    // Phase 0: Background maintenance (non-fatal)
    const nowUtc = new Date();
    await runRetryableReset(nowUtc).catch((e) => log("scheduler_config_fetch_warning", { runId, error: "runRetryableReset: " + String(e) }));
    await runStaleMonitor(nowUtc).catch((e) => log("scheduler_config_fetch_warning", { runId, error: "runStaleMonitor: " + String(e) }));
    await runSelfHealingSweeper().catch((e) => log("scheduler_config_fetch_warning", { runId, error: "runSelfHealingSweeper: " + String(e) }));

    // Phase 1: Query candidates (over-fetch for tier waterfall)
    const candidates = await findCandidateSteps(nowUtc, maxClaims * 3);
    candidatesFound = candidates.length;

    staleProcessingSteps = await findStaleProcessingSteps(nowUtc);
    if (staleProcessingSteps.length > 0) {
      log("stale_processing_steps_detected", {
        runId,
        count: staleProcessingSteps.length,
        stepIds: staleProcessingSteps.map((s) => s.stepId).join(","),
        note: "runStaleMonitor above handles auto-resolution.",
      });
    }

    log("candidates_found", { runId, candidatesFound, queryTime: nowUtc.toISOString() });

    // Phase 2: Tier waterfall + fairness ordering
    const tier1 = candidates.filter((s) => classifyTier(s, nowUtc) === 1);
    const lowerTiers = candidates.filter((s) => classifyTier(s, nowUtc) >= 2);

    // Reserve 20% for lower tiers only if lower-tier work exists (work-conserving)
    const lowerReserved = lowerTiers.length > 0 ? Math.floor(maxClaims * 0.20) : 0;
    // Sort Tier 1 by campaign.last_dispatched_at ASC
    const tier1Sorted = [...tier1].sort((a, b) => {
      const aTs = (a.sequence.prospect as any).campaign?.last_dispatched_at as string | null;
      const bTs = (b.sequence.prospect as any).campaign?.last_dispatched_at as string | null;
      if (!aTs && !bTs) return 0;
      if (!aTs) return -1;
      if (!bTs) return 1;
      return new Date(aTs).getTime() - new Date(bTs).getTime();
    });
    const tier1Cap = Math.min(tier1Sorted.length, maxClaims - lowerReserved);
    const tier1Selected = tier1Sorted.slice(0, tier1Cap);
    const remaining = maxClaims - tier1Selected.length;

    // Sort lower tiers by campaign.last_dispatched_at ASC (longest-unserved first)
    const lowerSorted = [...lowerTiers]
      .sort((a, b) => {
        const aTs = (a.sequence.prospect as any).campaign?.last_dispatched_at as string | null;
        const bTs = (b.sequence.prospect as any).campaign?.last_dispatched_at as string | null;
        if (!aTs && !bTs) return 0;
        if (!aTs) return -1;
        if (!bTs) return 1;
        return new Date(aTs).getTime() - new Date(bTs).getTime();
      })
      .slice(0, remaining);

    const orderedCandidates = [...tier1Selected, ...lowerSorted];

    // Phase 3: Eligibility recheck, capacity gate, atomic claim
    for (const step of orderedCandidates) {
      if (claimedSteps >= maxClaims) break;

      const eligibility = isStepFullyEligible(
        { status: step.status, scheduled_at_utc: step.scheduled_at_utc },
        { status: step.sequence.status },
        { status: step.sequence.prospect.status },
        nowUtc
      );

      if (!eligibility.eligible) {
        log("step_not_eligible", { runId, stepId: step.id, stepNumber: step.step_number, sequenceId: step.sequence.id, prospectId: step.sequence.prospect.id, reason: eligibility.reason, status: step.status });
        skippedSteps++;
        continue;
      }

      const campaignStatus = (step.sequence.prospect as any)?.campaign?.status;
      if (campaignStatus && campaignStatus !== "ACTIVE") {
        log("step_not_eligible", { runId, stepId: step.id, reason: `CAMPAIGN_${campaignStatus}` });
        skippedSteps++;
        continue;
      }

      if (step.sequence.user_id) {
        const userCap = await getUserCapacity(step.sequence.user_id, nowUtc);
        const effectiveDaily = Math.max(userCap.sentToday, userCap.sentLast24h) + userCap.claimedThisRun;
        const effectiveHourly = userCap.sentThisHour + userCap.claimedThisRun;
        if (effectiveDaily >= userCap.dailyLimit || effectiveHourly >= userCap.hourlyLimit) {
          log("step_skipped_user_capacity_exhausted", { runId, stepId: step.id, userId: step.sequence.user_id, effectiveDaily, dailyLimit: userCap.dailyLimit, effectiveHourly, hourlyLimit: userCap.hourlyLimit });
          skippedSteps++;
          continue;
        }
      }

      log("step_eligible", { runId, stepId: step.id, stepNumber: step.step_number, sequenceId: step.sequence.id, prospectId: step.sequence.prospect.id, prospectName: step.sequence.prospect.name, scheduledAt: step.scheduled_at_utc.toISOString(), dryRun });
      eligibleSteps++;

      if (dryRun) {
        claimedSteps++;
        claimedStepIds.push(step.id);
        if (step.sequence.user_id) {
          const userCap = userCapacityCache.get(step.sequence.user_id);
          if (userCap) userCap.claimedThisRun++;
        }
        continue;
      }

      let reservedEmail = step.sequence.assigned_sender_email;
      if (reservedEmail) {
        const reserved = await prisma.$executeRaw`
          UPDATE email_accounts 
          SET reserved_count = reserved_count + 1 
          WHERE email = ${reservedEmail.toLowerCase()} AND (sent_today + reserved_count) < daily_limit
        `;
        if (reserved === 0) {
          log("step_skipped_sender_capacity", { runId, stepId: step.id });
          skippedSteps++;
          continue;
        }
      }

      const claimResult = await claimStep(step.id, runId);

      switch (claimResult.outcome) {
        case "CLAIMED":
          claimedSteps++;
          claimedStepIds.push(step.id);
          if (step.sequence.user_id) {
            const userCap = userCapacityCache.get(step.sequence.user_id);
            if (userCap) userCap.claimedThisRun++;
          }
          log("step_claimed", { runId, stepId: step.id, stepNumber: step.step_number, sequenceId: step.sequence.id, prospectId: step.sequence.prospect.id, prospectName: step.sequence.prospect.name, scheduledAt: step.scheduled_at_utc.toISOString() });
          break;

        case "ALREADY_TAKEN":
          skippedSteps++;
          log("step_already_taken", { runId, stepId: step.id, reason: "Another scheduler run claimed this step first (race condition)." });
          if (reservedEmail) {
            await prisma.$executeRaw`UPDATE email_accounts SET reserved_count = GREATEST(0, reserved_count - 1) WHERE email = ${reservedEmail.toLowerCase()}`.catch(() => {});
          }
          break;

        case "ERROR":
          errorSteps++;
          const errMsg = claimResult.error ?? "Unknown claim error";
          errors.push("Step " + step.id + ": " + errMsg);
          log("step_claim_error", { runId, stepId: step.id, message: errMsg });
          if (reservedEmail) {
            await prisma.$executeRaw`UPDATE email_accounts SET reserved_count = GREATEST(0, reserved_count - 1) WHERE email = ${reservedEmail.toLowerCase()}`.catch(() => {});
          }
          break;
      }
    }

    // Phase 4: Build result
    const finishedAt = new Date();
    const durationMs = finishedAt.getTime() - startedAt.getTime();
    const status: SchedulerRunStatus = errorSteps === 0 ? "SUCCESS" : errorSteps < candidatesFound ? "PARTIAL_FAILURE" : "FAILED";

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

    log("scheduler_run_completed", { runId, candidatesFound, eligibleSteps, claimedSteps, skippedSteps, errorSteps, durationMs, dryRun, status });
    await prisma.$executeRaw`DELETE FROM scheduler_locks WHERE lock_name = 'main_scheduler' AND run_id = ${runId}`.catch(() => {});
    return result;

  } catch (error) {
    const finishedAt = new Date();
    const message = error instanceof Error ? error.message : "Unknown scheduler error";
    log("scheduler_run_failed", { runId, message, durationMs: finishedAt.getTime() - startedAt.getTime() });
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
      errors: [...errors, "Fatal scheduler error: " + message],
      claimedStepIds,
      dryRun,
      status: "FAILED",
      staleProcessingSteps,
    };
  } finally {
    if (lockAcquired) {
      await prisma.$executeRaw`DELETE FROM scheduler_locks WHERE lock_name = 'main_scheduler' AND run_id = ${runId}`.catch(() => {});
    }
  }
}

/**
 * Classify a step into a dispatch tier.
 * Tier 1: critically overdue follow-up | Tier 2: on-time follow-up or Express Step 1
 * Tier 3: Normal Step 1 | Tier 4: Low-priority Step 1
 */
function classifyTier(step: any, nowUtc: Date): 1 | 2 | 3 | 4 {
  const isFollowUp = step.step_number > 1;
  const softSla = step.soft_sla_deadline as Date | null;
  const isOverdue = softSla ? nowUtc >= new Date(softSla) : false;
  const priorityClass: string = step.priority_class || "NORMAL";
  if (isFollowUp && isOverdue) return 1;
  if (isFollowUp || priorityClass === "EXPRESS") return 2;
  if (priorityClass === "NORMAL") return 3;
  return 4;
}
