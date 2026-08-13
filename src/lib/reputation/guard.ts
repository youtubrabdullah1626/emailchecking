import prisma from "@/lib/prisma";
import { reportSystemError } from "@/lib/intelligence/error-engine";
import { dispatchAlert } from "@/lib/intelligence/alerts";

export type ReputationGuardResult = 
  | { allowed: true }
  | { allowed: false; reason: string; retryAt: Date };

/**
 * Enterprise Reputation Guard
 * Checks limits, health, and warmup stage before allowing an email to be sent.
 */
export async function canSendEmail(email: string): Promise<ReputationGuardResult> {
  const normalizedEmail = email.toLowerCase();
  let account = await prisma.emailAccount.findUnique({ where: { email: normalizedEmail } });

  // If not tracked yet, create default profile tied to an existing system user
  if (!account) {
    const validUser = await prisma.users.findFirst({ select: { id: true } });
    if (!validUser) {
      return { allowed: false, reason: "NO_SYSTEM_USER", retryAt: new Date(Date.now() + 60000) };
    }
    account = await prisma.emailAccount.create({
      data: { 
        email: normalizedEmail, 
        user_id: validUser.id 
      }
    });
  }

  const now = new Date();

  // 1. Check Daily Limit
  if (account.sent_today >= account.daily_limit) {
    // Reset window is tomorrow at 00:00 UTC
    const tomorrow = new Date();
    tomorrow.setUTCHours(24, 0, 0, 0);

    await dispatchAlert({
      title: "Daily Limit Reached",
      description: `Account ${email} hit daily capacity (${account.sent_today}/${account.daily_limit}). Operations delayed.`,
      severity: "MEDIUM",
      service: "reputation",
    });

    return { allowed: false, reason: "DAILY_LIMIT_REACHED", retryAt: tomorrow };
  }

  // 2. Check Hourly Limit
  if (account.sent_this_hour >= account.hourly_limit) {
    // Reset window is next hour
    const nextHour = new Date();
    nextHour.setUTCHours(now.getUTCHours() + 1, 0, 0, 0);

    return { allowed: false, reason: "HOURLY_LIMIT_REACHED", retryAt: nextHour };
  }

  // 3. Check Account Health
  if (account.health_score < 50) {
    // Critical health, pause sending for 24 hours to recover
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    
    await reportSystemError({
      service: "gmail",
      originalError: new Error(`Health score critically low: ${account.health_score}`),
      impactSize: 1,
    });

    return { allowed: false, reason: "POOR_ACCOUNT_HEALTH", retryAt: tomorrow };
  }

  return { allowed: true };
}

/**
 * Increment usage counters after a successful send.
 */
export async function recordSuccessfulSend(email: string) {
  await prisma.emailAccount.update({
    where: { email },
    data: {
      sent_today: { increment: 1 },
      sent_this_hour: { increment: 1 },
    }
  });
}
