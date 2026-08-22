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

  // 2. Also ensure all campaign prospects that have not replied are set to ACTIVE
  await prisma.prospect.updateMany({
    where: {
      campaign_id: campaignId,
      status: { notIn: ['REPLIED', 'STOPPED', 'COMPLETED'] }
    },
    data: { status: 'ACTIVE' }
  });

  // 3. Also ensure all campaign sequences that have not replied are set to ACTIVE
  await prisma.sequence.updateMany({
    where: {
      prospect: {
        campaign_id: campaignId,
        status: { not: 'REPLIED' }
      },
      status: { not: 'COMPLETED' }
    },
    data: { status: 'ACTIVE', stopped_at: null }
  });

  // 3. For any steps scheduled in the past or due, set eligible_after_utc = now so they can be dispatched immediately
  const now = new Date();
  await prisma.sequenceStep.updateMany({
    where: {
      sequence: { prospect: { campaign_id: campaignId } },
      status: 'PENDING',
      scheduled_at_utc: { lte: now }
    },
    data: { eligible_after_utc: now }
  });

  return { success: true, activeCount: activeCount + 1, limit: maxAllowed };
}

export async function pauseCampaign(campaignId: string, userId: string): Promise<{ success: boolean; message?: string }> {
  const dbUser = await prisma.users.findUnique({ where: { id: userId }, select: { role: true, email: true } });
  const isOwnerOrAdmin = dbUser?.role === 'SUPER_ADMIN' || dbUser?.role === 'OWNER' || dbUser?.role === 'ADMIN';

  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId }, select: { status: true, user_id: true } });
  if (!campaign) return { success: false, message: 'Campaign not found.' };
  if (campaign.user_id !== userId && !isOwnerOrAdmin) return { success: false, message: 'Unauthorized campaign access.' };
  if (campaign.status === 'PAUSED') return { success: true }; // Idempotent

  // 1. Update Campaign & Sequences status to PAUSED
  await prisma.campaign.update({ where: { id: campaignId }, data: { status: 'PAUSED' } });
  await prisma.sequence.updateMany({
    where: {
      prospect: { campaign_id: campaignId },
      status: { not: 'COMPLETED' }
    },
    data: { status: 'PAUSED' }
  });

  // 2. Immediately reset any in-flight PROCESSING steps back to PENDING
  try {
    const processingSteps = await prisma.sequenceStep.findMany({
      where: {
        status: 'PROCESSING',
        sequence: { prospect: { campaign_id: campaignId } }
      },
      select: { id: true, sequence: { select: { assigned_sender_email: true } } }
    });

    if (processingSteps.length > 0) {
      const stepIds = processingSteps.map(s => s.id);
      await prisma.sequenceStep.updateMany({
        where: { id: { in: stepIds } },
        data: { status: 'PENDING', claimed_at: null }
      });

      const senders = Array.from(new Set(processingSteps.map(s => s.sequence.assigned_sender_email).filter(Boolean))) as string[];
      for (const sender of senders) {
        await prisma.$executeRaw`
          UPDATE email_accounts
          SET reserved_count = GREATEST(0, reserved_count - 1)
          WHERE email = ${sender}
        `.catch(() => {});
      }
    }
  } catch (err) {
    console.error("[pauseCampaign] Failed to reset processing steps:", err);
  }

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
