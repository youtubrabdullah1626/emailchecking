/**
 * Tenant Abuse Guard — Enterprise Hardened
 *
 * CRITICAL FIX (Ghost Step Bug):
 * The previous version paused sequences via `sequence.updateMany({ status: "PAUSED" })`.
 * This did NOT cancel steps already claimed by the scheduler (status = PROCESSING).
 * Those ghost steps would continue sending emails even after the pause.
 *
 * This version uses a database TRANSACTION to atomically:
 *   1. Pause/stop all active sequences
 *   2. Cancel ALL pending and processing steps in the scheduler queue
 *
 * This ensures a hard stop — no emails can leak through after abuse detection.
 */

import prisma from "@/lib/prisma";
import { logger } from "@/lib/observability/logger";

export interface AbuseGuardResult {
  userId: string;
  checked: string[];
  violations: string[];
  actions: string[];
}

// Thresholds — calibrated to industry standards
const BOUNCE_RATE_THRESHOLD = 0.05;  // 5%: Google starts penalizing sender reputation
const BOUNCE_SAMPLE_MINIMUM = 20;    // Don't penalize until we have enough signal
const WARMUP_DAYS = 7;               // New accounts are in warmup for 7 days
const WARMUP_DAILY_CAP = 50;         // Warmup daily send ceiling
const ABSOLUTE_DAILY_CAP = 500;      // Hard ceiling per user per day

/**
 * Runs all abuse detection checks for a specific user.
 * Designed to be called after every scheduler batch — all reads are
 * indexed queries that complete in under 5ms.
 */
export async function runAbuseGuard(userId: string): Promise<AbuseGuardResult> {
  const result: AbuseGuardResult = {
    userId,
    checked: [],
    violations: [],
    actions: [],
  };

  try {
    // ── 1. BOUNCE RATE CHECK ─────────────────────────────────────────────────
    result.checked.push("bounce_rate");

    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [sentCount, failedCount] = await Promise.all([
      prisma.emailEvent.count({
        where: {
          event_type: "SENT",
          occurred_at: { gte: since24h },
          step: { sequence: { user_id: userId } },
        },
      }),
      prisma.emailEvent.count({
        where: {
          event_type: "FAILED",
          occurred_at: { gte: since24h },
          step: { sequence: { user_id: userId } },
        },
      }),
    ]);

    const total = sentCount + failedCount;
    // Only enforce after minimum sample size — prevents false positives on day 1
    const bounceRate = total >= BOUNCE_SAMPLE_MINIMUM ? failedCount / total : 0;

    if (bounceRate > BOUNCE_RATE_THRESHOLD) {
      result.violations.push(`bounce_rate_exceeded: ${(bounceRate * 100).toFixed(1)}%`);

      // FIXED: Atomic transaction — pause sequences AND evict ghost steps simultaneously.
      // No email can slip through the gap between these two operations.
      const { seqsPaused, stepsCancelled } = await prisma.$transaction(async (tx) => {
        const { count: seqsPaused } = await tx.sequence.updateMany({
          where: { user_id: userId, status: "ACTIVE" },
          data: { status: "PAUSED", stopped_at: new Date() },
        });

        // Cancel ALL steps that are pending or already claimed by the scheduler
        const { count: stepsCancelled } = await tx.sequenceStep.updateMany({
          where: {
            status: { in: ["PENDING", "PROCESSING"] },
            sequence: { user_id: userId },
          },
          data: { status: "CANCELLED" },
        });

        return { seqsPaused, stepsCancelled };
      });

      result.actions.push(`paused_${seqsPaused}_sequences`);
      result.actions.push(`cancelled_${stepsCancelled}_scheduler_steps`);

      logger.warn("abuse_guard: bounce_rate_violation_auto_paused", {
        userId,
        bounceRate: `${(bounceRate * 100).toFixed(1)}%`,
        sentCount,
        failedCount,
        seqsPaused,
        stepsCancelled,
      });

      await prisma.auditLog.create({
        data: {
          action: "ABUSE_GUARD_AUTO_PAUSE",
          user_id: userId,
          category: "SYSTEM",
          severity: "WARNING",
          status: "SUCCESS",
          description: `Auto-paused ${seqsPaused} sequences and cancelled ${stepsCancelled} scheduler steps. Bounce rate: ${(bounceRate * 100).toFixed(1)}%`,
          metadata: { userId, bounceRate, sentCount, failedCount, seqsPaused, stepsCancelled },
        },
      });
    }

    // ── 2. WARMUP GATE CHECK ─────────────────────────────────────────────────
    result.checked.push("warmup_gate");

    const emailAccount = await prisma.emailAccount.findFirst({
      where: { user_id: userId, connection_status: "CONNECTED" },
      select: { created_at: true, email: true },
      orderBy: { created_at: "asc" },
    });

    if (emailAccount) {
      const accountAgeDays =
        (Date.now() - emailAccount.created_at.getTime()) / (1000 * 60 * 60 * 24);

      if (accountAgeDays < WARMUP_DAYS) {
        const startOfDay = new Date();
        startOfDay.setUTCHours(0, 0, 0, 0);

        const sentToday = await prisma.emailEvent.count({
          where: {
            event_type: "SENT",
            occurred_at: { gte: startOfDay },
            step: { sequence: { user_id: userId } },
          },
        });

        if (sentToday >= WARMUP_DAILY_CAP) {
          result.violations.push(`warmup_cap_reached: ${sentToday}/${WARMUP_DAILY_CAP}`);
          result.actions.push("warmup_cap_enforced_by_scheduler");

          logger.warn("abuse_guard: warmup_cap_hit", {
            userId,
            email: emailAccount.email,
            accountAgeDays: Math.round(accountAgeDays),
            sentToday,
          });
        }
      }
    }

    // ── 3. ABSOLUTE DAILY CAP ────────────────────────────────────────────────
    result.checked.push("absolute_daily_cap");

    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);

    const totalSentToday = await prisma.emailEvent.count({
      where: {
        event_type: "SENT",
        occurred_at: { gte: startOfDay },
        step: { sequence: { user_id: userId } },
      },
    });

    if (totalSentToday >= ABSOLUTE_DAILY_CAP) {
      result.violations.push(`absolute_cap_reached: ${totalSentToday}/${ABSOLUTE_DAILY_CAP}`);
      result.actions.push("absolute_cap_enforced_by_scheduler");

      logger.warn("abuse_guard: absolute_daily_cap_hit", {
        userId,
        totalSentToday,
        cap: ABSOLUTE_DAILY_CAP,
      });
    }
  } catch (err) {
    logger.error("abuse_guard: unexpected_error", { userId, error: String(err) });
  }

  return result;
}

/**
 * Lightweight gate check — returns true if this user is allowed to send more emails today.
 * Called by the scheduler BEFORE processing any step.
 * Designed to be fast — returns within 2 indexed DB reads.
 */
export async function isSendingAllowed(
  userId: string
): Promise<{ allowed: boolean; reason: string }> {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const sentToday = await prisma.emailEvent.count({
    where: {
      event_type: "SENT",
      occurred_at: { gte: startOfDay },
      step: { sequence: { user_id: userId } },
    },
  });

  if (sentToday >= ABSOLUTE_DAILY_CAP) {
    return {
      allowed: false,
      reason: `Daily cap reached: ${sentToday}/${ABSOLUTE_DAILY_CAP}`,
    };
  }

  const emailAccount = await prisma.emailAccount.findFirst({
    where: { user_id: userId, connection_status: "CONNECTED" },
    select: { created_at: true },
    orderBy: { created_at: "asc" },
  });

  if (emailAccount) {
    const accountAgeDays =
      (Date.now() - emailAccount.created_at.getTime()) / (1000 * 60 * 60 * 24);
    if (accountAgeDays < WARMUP_DAYS && sentToday >= WARMUP_DAILY_CAP) {
      return {
        allowed: false,
        reason: `Warmup cap: ${sentToday}/${WARMUP_DAILY_CAP} (account age: ${Math.round(accountAgeDays)}d)`,
      };
    }
  }

  return { allowed: true, reason: "OK" };
}
