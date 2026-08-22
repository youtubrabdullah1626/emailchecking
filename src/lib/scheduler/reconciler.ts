import prisma from '@/lib/prisma';
import { createOAuth2ClientForAccount } from '@/lib/gmail/oauth';
import { google } from 'googleapis';

export async function runStaleMonitor(nowUtc: Date): Promise<void> {
  // Fast path 1: Instantly fix any PROCESSING step that already has a gmail_message_id
  await prisma.sequenceStep.updateMany({
    where: {
      status: 'PROCESSING',
      gmail_message_id: { not: null },
    },
    data: {
      status: 'SENT',
      sent_at: nowUtc,
    },
  }).catch(() => {});

  // Fast path 2: Any step claimed > 60 seconds ago without finishing is considered stale
  const staleBeforeUtc = new Date(nowUtc.getTime() - 60 * 1000); // 60 seconds
  
  const staleSteps = await prisma.sequenceStep.findMany({
    where: {
      status: 'PROCESSING',
      claimed_at: { lte: staleBeforeUtc }
    },
    include: {
      sequence: { select: { assigned_sender_email: true } }
    }
  });

  for (const step of staleSteps) {
    const latestAttempt = await prisma.sendAttempt.findFirst({
      where: { step_id: step.id },
      orderBy: { attempt_number: 'desc' }
    });

    if (!latestAttempt) {
      await prisma.sequenceStep.updateMany({
        where: { id: step.id, status: 'PROCESSING' },
        data: { status: 'PENDING', claimed_at: null }
      });
      if (step.sequence.assigned_sender_email) {
        await prisma.$executeRaw`
          UPDATE email_accounts 
          SET reserved_count = GREATEST(0, reserved_count - 1)
          WHERE email = ${step.sequence.assigned_sender_email}
        `;
      }
      console.log(`[StaleMonitor] Step ${step.id} reset to PENDING (no send_attempt)`);
    } else if (latestAttempt.gmail_message_id) {
      await prisma.sequenceStep.updateMany({
        where: { id: step.id, status: 'PROCESSING' },
        data: { status: 'SENT', sent_at: new Date() }
      });
      console.log(`[StaleMonitor] Step ${step.id} marked SENT (has gmail_message_id)`);
    } else {
      const outcome = await reconcileUncertainSend(
        step.id,
        latestAttempt.id,
        latestAttempt.sender_email,
        latestAttempt.recipient_email,
        latestAttempt.attempted_at
      );
      if (outcome === 'RECONCILED_SENT') {
        await prisma.sequenceStep.updateMany({ where: { id: step.id, status: 'PROCESSING' }, data: { status: 'SENT' }});
        console.log(`[StaleMonitor] Step ${step.id} RECONCILED_SENT`);
      } else if (outcome === 'SAFE_RETRY') {
        await prisma.sequenceStep.updateMany({ where: { id: step.id, status: 'PROCESSING' }, data: { status: 'PENDING' }});
        if (step.sequence.assigned_sender_email) {
          await prisma.$executeRaw`
            UPDATE email_accounts 
            SET reserved_count = GREATEST(0, reserved_count - 1)
            WHERE email = ${step.sequence.assigned_sender_email}
          `;
        }
        console.log(`[StaleMonitor] Step ${step.id} SAFE_RETRY`);
      } else {
        await prisma.sequenceStep.updateMany({ where: { id: step.id, status: 'PROCESSING' }, data: { status: 'UNCERTAIN' as any }});
        console.log(`[StaleMonitor] Step ${step.id} UNCERTAIN`);
      }
    }
  }
}

export async function reconcileUncertainSend(
  stepId: string,
  attemptId: string,
  senderEmail: string,
  recipientEmail: string,
  attemptedAt: Date
): Promise<'RECONCILED_SENT' | 'SAFE_RETRY' | 'UNCERTAIN'> {
  const attempt = await prisma.sendAttempt.findUnique({ where: { id: attemptId } }) as any;
  if (attempt && attempt.reconcile_attempts >= 3) {
    await prisma.sendAttempt.update({ where: { id: attemptId }, data: { status: 'UNRESOLVABLE' } as any });
    await prisma.systemError.create({
      data: { service: 'scheduler', errorType: 'UNCERTAIN_SEND', severity: 'HIGH', message: `Step ${stepId} unresolvable after 3 attempts` }
    });
    return 'UNCERTAIN';
  }

  await prisma.sendAttempt.update({ where: { id: attemptId }, data: { reconcile_attempts: { increment: 1 } } as any });

  try {
    const auth = await createOAuth2ClientForAccount(senderEmail);
    const gmail = google.gmail({ version: 'v1', auth: auth as any });
    
    // floor attempt - 90s
    const afterTime = Math.floor((attemptedAt.getTime() - 90 * 1000) / 1000);
    const query = `to:${recipientEmail} after:${afterTime}`;
    
    const res = await gmail.users.messages.list({ userId: 'me', q: query });
    const messages = res.data.messages || [];
    
    if (messages.length > 0) {
      await prisma.sendAttempt.update({ where: { id: attemptId }, data: { status: 'RECONCILED_SENT' }});
      return 'RECONCILED_SENT';
    }
    
    return 'SAFE_RETRY';
  } catch (err) {
    console.error(`Reconciliation failed for step ${stepId}`, err);
    return 'UNCERTAIN';
  }
}

export async function runSelfHealingSweeper(): Promise<void> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const sentSteps = await prisma.sequenceStep.findMany({
    where: {
      status: 'SENT',
      sent_at: { gte: thirtyDaysAgo },
      sequence: { status: 'ACTIVE' }
    },
    select: {
      id: true,
      sequence_id: true,
      step_number: true,
      sent_at: true,
      scheduled_at_utc: true
    },
    take: 100,
  });

  let healedCount = 0;
  for (const step of sentSteps) {
    if (!step.sent_at) continue;

    const nextStep = await prisma.sequenceStep.findFirst({
      where: {
        sequence_id: step.sequence_id,
        step_number: step.step_number + 1,
        status: 'PENDING',
        eligible_after_utc: null
      }
    });

    if (nextStep) {
      const scheduledDelayMs = nextStep.scheduled_at_utc.getTime() - step.scheduled_at_utc.getTime();
      const delayMs = scheduledDelayMs > 0 ? scheduledDelayMs : (2 * 24 * 60 * 60 * 1000);
      const eligibleAfter = new Date(step.sent_at.getTime() + delayMs);
      const slaBufferMs = Math.min(Math.max(delayMs * 0.5, 12 * 3600 * 1000), 72 * 3600 * 1000);
      const softSlaDead = new Date(eligibleAfter.getTime() + slaBufferMs);
      const updateRes = await prisma.sequenceStep.updateMany({
        where: { id: nextStep.id, eligible_after_utc: null },
        data: { eligible_after_utc: eligibleAfter, soft_sla_deadline: softSlaDead }
      });
      if (updateRes.count > 0) {
        healedCount++;
      }
    }
  }
  
  if (healedCount > 0) {
    console.log(`[SelfHealingSweeper] Healed ${healedCount} orphaned steps.`);
  }
}

export async function runRetryableReset(nowUtc: Date): Promise<void> {
  const result = await prisma.sequenceStep.updateMany({
    where: {
      status: 'RETRYABLE_FAILURE' as any,
      retry_at: { lte: nowUtc }
    },
    data: {
      status: 'PENDING',
      retry_at: null
    }
  });
  if (result.count > 0) {
    console.log(`[RetryableReset] Reset ${result.count} retryable steps.`);
  }
}
