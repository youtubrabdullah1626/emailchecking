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
  
  const activeCount = await prisma.campaign.count({ where: { user_id: userId, status: 'ACTIVE' } });
  if (activeCount >= maxAllowed && !isOwnerOrAdmin) {
    return {
      success: false,
      error: 'PLAN_LIMIT_REACHED',
      message: `Your account allows a maximum of ${maxAllowed} active campaigns. Pause or complete an active campaign before starting another campaign.`,
      activeCount,
      limit: maxAllowed,
    };
  }
  
  // 1. Activate Campaign
  await prisma.campaign.update({ where: { id: campaignId }, data: { status: 'ACTIVE' } });

  // 2. Activate Prospects
  await prisma.$executeRaw`
    UPDATE prospects
    SET status = 'ACTIVE'
    WHERE campaign_id = ${campaignId}
      AND status NOT IN ('REPLIED', 'STOPPED', 'COMPLETED')
  `.catch(() => {});

  // 3. Activate Sequences
  await prisma.$executeRaw`
    UPDATE sequences seq
    SET status = 'ACTIVE', stopped_at = NULL
    FROM prospects p
    WHERE seq.prospect_id = p.id
      AND p.campaign_id = ${campaignId}
      AND seq.status != 'COMPLETED'
  `.catch(() => {});

  // 4. Set eligible_after_utc = now and scheduled_at_utc = now for pending steps so they dispatch immediately on resume
  await prisma.$executeRaw`
    UPDATE sequence_steps s
    SET scheduled_at_utc = LEAST(s.scheduled_at_utc, NOW()),
        eligible_after_utc = NOW()
    FROM sequences seq
    JOIN prospects p ON seq.prospect_id = p.id
    WHERE s.sequence_id = seq.id
      AND p.campaign_id = ${campaignId}
      AND s.status = 'PENDING'
  `.catch(() => {});

  return { success: true, activeCount: activeCount + 1, limit: maxAllowed };
}

export async function pauseCampaign(campaignId: string, userId: string): Promise<{ success: boolean; message?: string }> {
  const dbUser = await prisma.users.findUnique({ where: { id: userId }, select: { role: true, email: true } });
  const isOwnerOrAdmin = dbUser?.role === 'SUPER_ADMIN' || dbUser?.role === 'OWNER' || dbUser?.role === 'ADMIN';

  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId }, select: { status: true, user_id: true } });
  if (!campaign) return { success: false, message: 'Campaign not found.' };
  if (campaign.user_id !== userId && !isOwnerOrAdmin) return { success: false, message: 'Unauthorized campaign access.' };
  if (campaign.status === 'PAUSED') return { success: true }; // Idempotent

  // 1. Update Campaign status to PAUSED
  await prisma.campaign.update({ where: { id: campaignId }, data: { status: 'PAUSED' } });

  // 2. Pause Sequences
  await prisma.$executeRaw`
    UPDATE sequences seq
    SET status = 'PAUSED'
    FROM prospects p
    WHERE seq.prospect_id = p.id
      AND p.campaign_id = ${campaignId}
      AND seq.status != 'COMPLETED'
  `.catch(() => {});

  // 3. Immediately reset any in-flight PROCESSING steps back to PENDING
  await prisma.$executeRaw`
    UPDATE sequence_steps s
    SET status = 'PENDING', claimed_at = NULL
    FROM sequences seq
    JOIN prospects p ON seq.prospect_id = p.id
    WHERE s.sequence_id = seq.id
      AND p.campaign_id = ${campaignId}
      AND s.status = 'PROCESSING'
  `.catch(() => {});

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
