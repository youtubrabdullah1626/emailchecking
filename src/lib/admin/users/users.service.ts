import { AdminUsersRepository, GetUsersFilters } from "./users.repository";
import { MockUser } from "@/app/admin/users/types";
import { isOwnerEmail } from "@/lib/auth/roles";

export class AdminUsersService {
  private repository: AdminUsersRepository;

  constructor() {
    this.repository = new AdminUsersRepository();
  }

  /**
   * Retrieves paginated users and maps the raw DB schema to the clean frontend API contract.
   * This insulates the UI from future database schema changes (e.g. moving from EmailAccount to User).
   */
  async getPaginatedUsers(filters: GetUsersFilters) {
    const { data, total, settings } = await this.repository.getUsers(filters);
    
    const emails = data.map(acc => acc.email);
    const { activeSendsMap, metricsMap } = await this.repository.getAccountAggregates(emails);

    const mappedUsers: MockUser[] = data.map((account) => {
      // 100% Honest "Active Status"
      // User must be connected AND have sent emails recently to be truly Active.
      let status: MockUser["status"] = "Active";
      const recentSends = activeSendsMap[account.email] || 0;

      if (account.connection_status === "BANNED") status = "Banned";
      else if (account.connection_status === "SUSPENDED") status = "Suspended";
      else if (account.connection_status === "DISCONNECTED") status = "Suspended"; // Mapping to Suspended for UI
      else if (recentSends === 0) status = "Idle";

      // 100% Honest Data Tracking
      const metrics = metricsMap[account.email] || { total: 0, replied: 0, bounced: 0 };
      const replyRate = metrics.total > 0 ? Number(((metrics.replied / metrics.total) * 100).toFixed(1)) : 0;
      const bounceRate = metrics.total > 0 ? Number(((metrics.bounced / metrics.total) * 100).toFixed(1)) : 0;

      let health: MockUser["health"] = "Excellent";
      if (account.health_score < 50) health = "Critical";
      else if (account.health_score < 80) health = "Warning";
      else if (account.health_score < 95) health = "Good";

      // 100% Honest Last Online
      const lastOnlineString = account.last_seen_at 
        ? new Date(account.last_seen_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
        : (account.last_login_at 
          ? new Date(account.last_login_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
          : "Never Logged In");

      let userRole = isOwnerEmail(account.email) ? "OWNER" : ((account as any).users?.role || "USER");

      return {
        id: account.user_id || account.email,
        name: (account.email.split("@")[0] || "User").replace(".", " "),
        email: account.email,
        role: userRole,
        plan: "Enterprise", // Stubbed until Billing module exists
        status,
        health,
        joinedAt: new Date(account.created_at).toLocaleDateString(),
        lastLogin: lastOnlineString,
        emailsSent: account.sent_today,
        schedulerStatus: status === "Active" ? "Healthy" : "Halted",
        gmailStatus: account.connection_status === "CONNECTED" ? "Connected" : "Disconnected",
        totalReplies: metrics.replied,
        replyRate,
        bounceRate,
        avatarUrl: `https://i.pravatar.cc/150?u=${account.email}`
      };
    });

    return {
      users: mappedUsers,
      pagination: {
        total,
        limit: filters.limit || 50,
        offset: filters.offset || 0,
      }
    };
  }

  /**
   * Retrieves a fully hydrated user profile.
   */
  async getUserProfile(emailOrId: string) {
    const account = await this.repository.getUserDetails(emailOrId);
    if (!account) return null;

    // We can aggregate data from multiple repositories here (e.g., Support tickets, Stripe).
    return account;
  }

  /**
   * Block a user (Temporary or Permanent).
   */
  async blockUser(email: string, adminId: string, type: "temporary" | "permanent") {
    if (!email || !type) throw new Error("Invalid block parameters.");

    const newStatus = type === "permanent" ? "BANNED" : "SUSPENDED";
    const reason = `User ${type === "permanent" ? "banned" : "suspended"} by admin`;

    const updated = await this.repository.updateUserStatusWithAudit(
      email,
      newStatus,
      adminId,
      reason
    );
    return updated;
  }

  /**
   * Unblock a user.
   */
  async unblockUser(email: string, adminId: string) {
    if (!email) throw new Error("Invalid unblock parameters.");

    const updated = await this.repository.updateUserStatusWithAudit(
      email,
      "CONNECTED",
      adminId,
      "User unblocked by admin"
    );
    return updated;
  }
}

export const adminUsersService = new AdminUsersService();
