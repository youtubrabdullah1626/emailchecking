import prisma from "@/lib/prisma";

export interface GetUsersFilters {
  search?: string;
  plan?: string;
  status?: string;
  role?: string;
  limit?: number;
  offset?: number;
}

export class AdminUsersRepository {
  /**
   * Retrieves a paginated list of all customers (EmailAccounts mapping to Users).
   */
  async getUsers(filters: GetUsersFilters) {
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    const where: any = {};

    if (filters.search) {
      where.OR = [
        { email: { contains: filters.search, mode: "insensitive" } },
        { user_id: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    if (filters.status) {
      // If the UI filters by "Active", we check "CONNECTED".
      const statusMap: Record<string, string> = {
        active: "CONNECTED",
        suspended: "DISCONNECTED",
        banned: "BANNED"
      };
      const dbStatus = statusMap[filters.status.toLowerCase()];
      if (dbStatus) {
        where.connection_status = dbStatus;
      }
    }

    const [accounts, total, settings] = await Promise.all([
      prisma.emailAccount.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { created_at: "desc" },
        select: {
          email: true,
          user_id: true,
          connection_status: true,
          health_score: true,
          created_at: true,
          updated_at: true,
          last_login_at: true,
          last_seen_at: true,
          sent_today: true,
          sent_this_hour: true,
          daily_limit: true,
        },
      }),
      prisma.emailAccount.count({ where }),
      prisma.systemSettings.findUnique({ where: { id: 'global' } })
    ]);

    return { data: accounts, total, settings: settings || { monthly_ai_credit_limit: 50000 } };
  }

  /**
   * Retrieves full details for a single customer by ID or Email.
   */
  async getUserDetails(emailOrId: string) {
    return prisma.emailAccount.findFirst({
      where: {
        OR: [
          { email: emailOrId },
          { user_id: emailOrId }
        ]
      }
    });
  }

  /**
   * Retrieves aggregated usage data (recent sends, replies, bounces) for a batch of emails.
   */
  async getAccountAggregates(emails: string[]) {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const activeSends = await prisma.trackedEmail.groupBy({
      by: ['sender_email'],
      where: { 
        sender_email: { in: emails },
        created_at: { gte: sevenDaysAgo }
      },
      _count: { id: true }
    });

    const statusCounts = await prisma.trackedEmail.groupBy({
      by: ['sender_email', 'status'],
      where: { sender_email: { in: emails } },
      _count: { id: true }
    });

    const activeSendsMap = Object.fromEntries(activeSends.map(x => [x.sender_email, x._count.id || 0]));
    
    // Group up the metrics for fast calculation
    const metricsMap: Record<string, { total: number; replied: number; bounced: number }> = {};
    for (const email of emails) {
      metricsMap[email] = { total: 0, replied: 0, bounced: 0 };
    }

    for (const record of statusCounts) {
      const email = record.sender_email;
      if (!metricsMap[email]) continue;
      
      const count = record._count.id || 0;
      metricsMap[email].total += count;
      
      if (record.status === "REPLIED") metricsMap[email].replied += count;
      if (record.status === "BOUNCED") metricsMap[email].bounced += count;
    }

    return { activeSendsMap, metricsMap };
  }

  /**
   * Modifies a user's status within an atomic transaction alongside an audit log.
   */
  async updateUserStatusWithAudit(
    email: string,
    newStatus: string,
    adminId: string,
    reason: string
  ) {
    return prisma.$transaction(async (tx) => {
      const updated = await tx.emailAccount.update({
        where: { email },
        data: { connection_status: newStatus },
      });

      await tx.auditLog.create({
        data: {
          action_type: "SYSTEM_ACTION",
          action: `ADMIN_UPDATE_USER_STATUS`,
          user_id: adminId,
          metadata: { target_email: email, new_status: newStatus, reason },
        },
      });

      return updated;
    });
  }
}
