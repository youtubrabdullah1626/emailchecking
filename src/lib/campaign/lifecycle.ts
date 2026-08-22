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
  return await prisma.$transaction(async (tx) => {
    // Serialize concurrent activations for the same user
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;

    const campaign = await tx.campaign.findUnique({ where: { id: campaignId }, select: { id: true, status: true, user_id: true } });
    if (!campaign || campaign.user_id !== userId) return { success: false, error: 'CAMPAIGN_NOT_FOUND', message: 'Campaign not found.' };
    
    // Idempotent: If already ACTIVE, return success instantly
    if (campaign.status === 'ACTIVE') return { success: true };

    if (!['DRAFT', 'PAUSED'].includes(campaign.status)) {
      return { success: false, error: 'INVALID_TRANSITION', message: `Cannot activate a ${campaign.status} campaign.` };
    }

    // Auto-complete any other campaigns for this user that have zero remaining pending steps
    await tx.$executeRaw`
      UPDATE campaigns c
      SET status = 'COMPLETED'
      WHERE c.user_id = ${userId}
        AND c.status = 'ACTIVE'
        AND c.id != ${campaignId}
        AND NOT EXISTS (
          SELECT 1 
          FROM sequence_steps ss
          JOIN sequences s ON ss.sequence_id = s.id
          JOIN prospects p ON s.prospect_id = p.id
          WHERE p.campaign_id = c.id
            AND ss.status IN ('PENDING', 'PROCESSING', 'RETRYABLE_FAILURE')
        )
    `;

    // Derive plan limit based on user role (Owners/Admins get ENTERPRISE capacity)
    const dbUser = await tx.users.findUnique({ where: { id: userId }, select: { role: true } });
    const isSuperOrAdmin = dbUser?.role === 'SUPER_ADMIN' || dbUser?.role === 'OWNER' || dbUser?.role === 'ADMIN';
    const plan: PlanType = isSuperOrAdmin ? 'ENTERPRISE' : 'FREE';
    const maxAllowed = PLAN_LIMITS[plan].MAX_ACTIVE_CAMPAIGNS;
    
    const activeCount = await tx.campaign.count({ where: { user_id: userId, status: 'ACTIVE' } });
    if (activeCount >= maxAllowed) {
      return {
        success: false,
        error: 'PLAN_LIMIT_REACHED',
        message: `Your account allows a maximum of ${maxAllowed} active campaigns. Pause or complete an active campaign before starting another campaign.`,
        activeCount,
        limit: maxAllowed,
      };
    }
    
    await tx.campaign.update({ where: { id: campaignId }, data: { status: 'ACTIVE' } });

    // Also ensure all campaign sequences that have not replied are set to ACTIVE
    await tx.sequence.updateMany({
      where: {
        prospect: {
          campaign_id: campaignId,
          status: { not: 'REPLIED' }
        },
        status: { in: ['DRAFT', 'STOPPED'] }
      },
      data: { status: 'ACTIVE', stopped_at: null }
    });

    return { success: true, activeCount: activeCount + 1, limit: maxAllowed };
  });
}

export async function pauseCampaign(campaignId: string, userId: string): Promise<{ success: boolean; message?: string }> {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId }, select: { status: true, user_id: true } });
  if (!campaign || campaign.user_id !== userId) return { success: false, message: 'Campaign not found.' };
  if (campaign.status === 'PAUSED') return { success: true }; // Idempotent
  if (campaign.status !== 'ACTIVE') return { success: false, message: 'Only ACTIVE campaigns can be paused.' };
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
