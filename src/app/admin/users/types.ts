export interface MockUser {
  id: string;
  name: string;
  email: string;
  role: "Admin" | "User";
  plan: "Free" | "Starter" | "Pro" | "Enterprise";
  status: "Active" | "Suspended" | "Banned" | "Pending Verification" | "Idle";
  health: "Excellent" | "Good" | "Warning" | "Critical";
  joinedAt: string;
  lastLogin: string;
  emailsSent: number;
  schedulerStatus: "Healthy" | "Halted" | "Warning";
  gmailStatus: "Connected" | "Expired" | "Disconnected";
  totalReplies: number;
  replyRate: number;
  bounceRate: number;
  avatarUrl?: string;
}
