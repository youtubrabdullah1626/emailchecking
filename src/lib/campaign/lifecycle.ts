import prisma from "@/lib/prisma";

export const PLAN_LIMITS = {
  FREE: { MAX_ACTIVE_CAMPAIGNS: 2 },
  PRO: { MAX_ACTIVE_CAMPAIGNS: 10 },
  ENTERPRISE: { MAX_ACTIVE_CAMPAIGNS: 50 },
} as const;

export type PlanType = keyof typeof PLAN_LIMITS;

export interface ActivationResult {
  success: boolean;
  error?: 'PLAN_LIMIT_REACHED' | 'CAMPAIGN_NOT_FOUND' | 'INVALID_TRANSITION';
  message?: string;
  activeCount?: number;
  limit?: number;
}

export async function activateCampaign(campaignId: string, userId: string): Promise<ActivationResult> {
  const dbUser = await prisma.users.findUnique({ where: { id: userId }, select: { role: true, email: true } });
  const isOwnerOrAdmin = dbUser?.role === 'SUPER_ADMIN' || dbUser?.role === 'OWNER' || dbUser?.role === 'ADMIN';

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { id: true, status: true, user_id: true }
  });
  if (!campaign) {
    return { success: false, error: 'CAMPAIGN_NOT_FOUND', message: 'Campaign not found.' };
  }
  if (campaign.user_id !== userId && !isOwnerOrAdmin) {
    return { success: false, error: 'CAMPAIGN_NOT_FOUND', message: 'Unauthorized campaign access.' };
  }
  
  // Idempotent: If already ACTIVE, return success instantly
  if (campaign.status === 'ACTIVE') return { success: true };

  if (['COMPLETED', 'ARCHIVED'].includes(campaign.status)) {
    return { success: false, error: 'INVALID_TRANSITION', message: `Cannot activate a ${campaign.status} campaign.` };
  }

  const plan: PlanType = isOwnerOrAdmin ? 'ENTERPRISE' : 'FREE';
  const maxAllowed = PLAN_LIMITS[plan].MAX_ACTIVE_CAMPAIGNS;
  
  return await prisma.$transaction(async (tx) => {
    // 1. Acquire advisory lock on userId to serialize concurrent activations (prevent TOCTOU limit bypass)
    let lockKey = 0;
    const lockStr = `activate_${userId}`;
    for (let i = 0; i < lockStr.length; i++) {
      lockKey = Math.imul(31, lockKey) + lockStr.charCodeAt(i) | 0;
    }
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey})`;

    const activeCount = await tx.campaign.count({ where: { user_id: userId, status: 'ACTIVE' } });
    if (activeCount >= maxAllowed && !isOwnerOrAdmin) {
      return {
        success: false,
        error: 'PLAN_LIMIT_REACHED',
        message: `Your account allows a maximum of ${maxAllowed} active campaigns. Pause or complete an active campaign before starting another campaign.`,
        activeCount,
        limit: maxAllowed,
      };
    }
    
    // 2. Activate Campaign
    await tx.campaign.update({ where: { id: campaignId }, data: { status: 'ACTIVE' } });

    // 3. Activate Prospects
    await tx.$executeRaw`
      UPDATE prospects
      SET status = 'ACTIVE'
      WHERE campaign_id = ${campaignId}
        AND status NOT IN ('REPLIED', 'STOPPED', 'COMPLETED')
    `.catch(() => {});

    // 4. Activate Sequences
    await tx.$executeRaw`
      UPDATE sequences seq
      SET status = 'ACTIVE', stopped_at = NULL
      FROM prospects p
      WHERE seq.prospect_id = p.id
        AND p.campaign_id = ${campaignId}
        AND seq.status != 'COMPLETED'
    `.catch(() => {});

    // 5. Time-Aware Activation (10x Smart SaaS Rule):
    await tx.$executeRaw`
      UPDATE sequence_steps s
      SET eligible_after_utc = s.scheduled_at_utc
      FROM sequences seq
      JOIN prospects p ON seq.prospect_id = p.id
      WHERE s.sequence_id = seq.id
        AND p.campaign_id = ${campaignId}
        AND s.status = 'PENDING'
        AND s.step_number = 1
    `.catch(() => {});

    await tx.$executeRaw`
      UPDATE sequence_steps s
      SET eligible_after_utc = s.scheduled_at_utc
      FROM sequences seq
      JOIN prospects p ON seq.prospect_id = p.id
      WHERE s.sequence_id = seq.id
        AND p.campaign_id = ${campaignId}
        AND s.status = 'PENDING'
        AND s.step_number > 1
        AND EXISTS (
          SELECT 1 FROM sequence_steps prev
          WHERE prev.sequence_id = seq.id
            AND prev.step_number = s.step_number - 1
            AND prev.status = 'SENT'
        )
    `.catch(() => {});

    return { success: true, activeCount: activeCount + 1, limit: maxAllowed };
  });

}

export async function pauseCampaign(campaignId: string, userId: string): Promise<{ success: boolean; message?: string }> {
  const dbUser = await prisma.users.findUnique({ where: { id: userId }, select: { role: true, email: true } });
  const isOwnerOrAdmin = dbUser?.role === 'SUPER_ADMIN' || dbUser?.role === 'OWNER' || dbUser?.role === 'ADMIN';

  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId }, select: { status: true, user_id: true } });
  if (!campaign) return { success: false, message: 'Campaign not found.' };
  if (campaign.user_id !== userId && !isOwnerOrAdmin) return { success: false, message: 'Unauthorized campaign access.' };
  if (campaign.status === 'PAUSED') return { success: true }; // Idempotent

  // STEP 1 (FIRST — Emergency Brake):
  // Immediately reset any in-flight PROCESSING steps back to PENDING
  // and release their reserved_count on email_accounts.
  // This MUST run before pausing sequences so that sender.ts's live re-read
  // sees status=PENDING and aborts before calling the Gmail API.
  await prisma.$executeRaw`
    WITH reset_steps AS (
      UPDATE sequence_steps s
      SET status = 'PENDING', claimed_at = NULL
      FROM sequences seq
      JOIN prospects p ON seq.prospect_id = p.id
      WHERE s.sequence_id = seq.id
        AND p.campaign_id = ${campaignId}
        AND s.status = 'PROCESSING'
      RETURNING seq.assigned_sender_email
    )
    UPDATE email_accounts ea
    SET reserved_count = GREATEST(0, ea.reserved_count - (
      SELECT COUNT(*) FROM reset_steps rs WHERE rs.assigned_sender_email = ea.email
    ))
    WHERE ea.email IN (SELECT assigned_sender_email FROM reset_steps WHERE assigned_sender_email IS NOT NULL)
  `.catch(() => {});

  // STEP 2: Pause all ACTIVE sequences for this campaign
  await prisma.$executeRaw`
    UPDATE sequences seq
    SET status = 'PAUSED'
    FROM prospects p
    WHERE seq.prospect_id = p.id
      AND p.campaign_id = ${campaignId}
      AND seq.status NOT IN ('COMPLETED', 'STOPPED')
  `.catch(() => {});

  // STEP 3: Finally mark the campaign itself as PAUSED
  await prisma.campaign.update({ where: { id: campaignId }, data: { status: 'PAUSED' } });

  return { success: true };
}


export async function completeCampaign(campaignId: string): Promise<void> {
  await prisma.campaign.update({ where: { id: campaignId }, data: { status: 'COMPLETED' } });
}

/** Called after every step dispatch — checks if campaign is fully complete */
export async function checkAndAutoComplete(campaignId: string): Promise<void> {
  // Count any non-terminal steps still belonging to this campaign
  const pendingCount = await prisma.sequenceStep.count({
    where: {
      status: { in: ['PENDING', 'PROCESSING', 'RETRYABLE_FAILURE'] },
      sequence: { prospect: { campaign_id: campaignId } }
    }
  });
  if (pendingCount === 0) {
    await prisma.campaign.update({ where: { id: campaignId }, data: { status: 'COMPLETED' } }).catch(() => {});
  }
}
