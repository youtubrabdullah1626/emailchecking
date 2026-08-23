import prisma from "@/lib/prisma";
import { reportSystemError } from "@/lib/intelligence/error-engine";
import { dispatchAlert } from "@/lib/intelligence/alerts";
import { getStartOfDayInTimezone, getStartOfHour } from "@/lib/date-utils";

export type ReputationGuardResult = 
  | { allowed: true; sentToday?: number; sentThisHour?: number }
  | { allowed: false; reason: string; retryAt: Date; sentToday?: number; sentThisHour?: number };

/**
 * Calculates the automated warmup ramp-up limit based on the inbox creation age.
 * - Days 1–3 (0–2 days old): Max 10/day
 * - Days 4–7 (3–6 days old): Max 25/day
 * - Day 8+ (7+ days old) or warmup_status === "COMPLETED": Full configured limit
 */
export function calculateRampUpLimit(
  createdAt: Date | string | null | undefined,
  baseLimit: number = 50,
  warmupStatus: string = "ACTIVE",
  referenceDate: Date = new Date()
): number {
  if (!createdAt || warmupStatus === "COMPLETED" || warmupStatus === "SKIPPED") {
    return baseLimit;
  }

  const createdTime = new Date(createdAt).getTime();
  const nowTime = referenceDate.getTime();
  const ageInDays = Math.max(0, Math.floor((nowTime - createdTime) / (1000 * 60 * 60 * 24)));

  if (ageInDays <= 2) {
    return Math.min(baseLimit, 10);
  }
  if (ageInDays <= 6) {
    return Math.min(baseLimit, 25);
  }
  return baseLimit;
}

/**
 * Enterprise Reputation Guard
 * 
 * Mathematically validates sender sending limits, mailbox health, and warmup stages
 * using real database events (EmailEvent source of truth) with timezone-aware midnight
 * resets and top-of-the-hour velocity resets.
 */
export async function canSendEmail(email: string): Promise<ReputationGuardResult> {
  const normalizedEmail = email.toLowerCase();
  let account = await prisma.emailAccount.findUnique({
    where: { email: normalizedEmail },
    include: {
      users: {
        select: {
          id: true,
          timezone: true,
        },
      },
    },
  });

  // If not tracked yet, create default profile tied to an existing system user
  if (!account) {
    const validUser = await prisma.users.findFirst({ select: { id: true, timezone: true } });
    if (!validUser) {
      return { allowed: false, reason: "NO_SYSTEM_USER", retryAt: new Date(Date.now() + 60000) };
    }
    account = await prisma.emailAccount.create({
      data: { 
        email: normalizedEmail, 
        user_id: validUser.id 
      },
      include: {
        users: {
          select: {
            id: true,
            timezone: true,
          },
        },
      },
    });
  }

  const now = new Date();
  const userTimezone = account.users?.timezone || "UTC";

  // 1. Timezone-aware reset boundaries
  const startOfDay = getStartOfDayInTimezone(userTimezone, now);
  const startOfHour = getStartOfHour(now);
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // 2. Fetch dynamic platform configurations (if any) or fallback to account limits
  const [dailyConfig, hourlyConfig, sentToday, sentThisHour, sentLast24h] = await Promise.all([
    prisma.platform_configs?.findFirst ? prisma.platform_configs.findFirst({ where: { key: "MAX_DAILY_EMAILS" } }) : Promise.resolve(null),
    prisma.platform_configs?.findFirst ? prisma.platform_configs.findFirst({ where: { key: "HOURLY_EMAIL_LIMIT" } }) : Promise.resolve(null),
    prisma.emailEvent?.count
      ? prisma.emailEvent.count({
          where: {
            event_type: "SENT",
            occurred_at: { gte: startOfDay },
            step: { 
              sequence: { 
                user_id: account.user_id,
                assigned_sender_email: normalizedEmail 
              } 
            },
          },
        })
      : Promise.resolve(0),
    prisma.emailEvent?.count
      ? prisma.emailEvent.count({
          where: {
            event_type: "SENT",
            occurred_at: { gte: startOfHour },
            step: { 
              sequence: { 
                user_id: account.user_id,
                assigned_sender_email: normalizedEmail 
              } 
            },
          },
        })
      : Promise.resolve(0),
    prisma.emailEvent?.count
      ? prisma.emailEvent.count({
          where: {
            event_type: "SENT",
            occurred_at: { gte: twentyFourHoursAgo },
            step: { 
              sequence: { 
                user_id: account.user_id,
                assigned_sender_email: normalizedEmail 
              } 
            },
          },
        })
      : Promise.resolve(0),
  ]);

  const configuredDailyLimit = dailyConfig?.value
    ? parseInt(String(dailyConfig.value), 10)
    : account.daily_limit || 50;

  const dailyLimit = calculateRampUpLimit(
    account.created_at,
    configuredDailyLimit,
    account.warmup_status,
    now
  );

  const hourlyLimit = hourlyConfig?.value
    ? parseInt(String(hourlyConfig.value), 10)
    : account.hourly_limit || 15;

  // Use live database EmailEvent counts for truth (not stale cached columns from previous days)
  const effectiveSentToday = sentToday;
  const effectiveSentThisHour = sentThisHour;
  const effectiveSentLast24h = sentLast24h;

  // Background sync counter cache for dashboard cards & admin visibility

  if (prisma.emailAccount?.update) {
    try {
      const updatePromise = prisma.emailAccount.update({
        where: { email: normalizedEmail },
        data: {
          sent_today: effectiveSentToday,
          sent_this_hour: effectiveSentThisHour,
          last_seen_at: now,
        },
      });
      if (updatePromise && typeof updatePromise.catch === "function") {
        updatePromise.catch(() => {});
      }
    } catch {}
  }

  // 3. Daily Limit Enforcement (Local Midnight + 24-Hour Absolute Exploit Guard)
  const effectiveDailySent = Math.max(effectiveSentToday, effectiveSentLast24h);
  if (effectiveDailySent >= dailyLimit) {
    const nextMidnightReset = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    await dispatchAlert({
      title: "Daily Limit Reached",
      description: `Account ${email} reached daily capacity (${effectiveDailySent}/${dailyLimit}). Auto-resets at local midnight (${userTimezone}).`,
      severity: "MEDIUM",
      service: "reputation",
    }).catch(() => {});

    return {
      allowed: false,
      reason: "DAILY_LIMIT_REACHED",
      retryAt: nextMidnightReset,
      sentToday: effectiveSentToday,
      sentThisHour: effectiveSentThisHour,
    };
  }

  // 4. Hourly Limit Enforcement (Top of the Hour Snap)
  if (effectiveSentThisHour >= hourlyLimit) {
    const nextHourReset = new Date(startOfHour.getTime() + 60 * 60 * 1000);

    return {
      allowed: false,
      reason: "HOURLY_LIMIT_REACHED",
      retryAt: nextHourReset,
      sentToday: effectiveSentToday,
      sentThisHour: effectiveSentThisHour,
    };
  }

  // 5. Account Health Evaluation
  if (account.health_score < 50) {
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    
    await reportSystemError({
      service: "gmail",
      originalError: new Error(`Health score critically low: ${account.health_score}`),
      impactSize: 1,
    }).catch(() => {});

    return {
      allowed: false,
      reason: "POOR_ACCOUNT_HEALTH",
      retryAt: tomorrow,
      sentToday,
      sentThisHour,
    };
  }

  return { allowed: true, sentToday, sentThisHour };
}

/**
 * Record a successful send event and refresh account activity timestamps.
 */
export async function recordSuccessfulSend(email: string) {
  const normalizedEmail = email.toLowerCase();
  await prisma.emailAccount.update({
    where: { email: normalizedEmail },
    data: {
      last_seen_at: new Date(),
    },
  }).catch(() => {});
}
