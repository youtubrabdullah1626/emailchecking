export interface ClientReportMetrics {
  totalContacted: number;
  totalDelivered: number;
  deliveryRate: number;
  totalOpened: number;
  openRate: number;
  realReplies: number;
  replyRate: number;
  bounces: number;
  domainHealth: number;
}

export interface ReportLeadActivity {
  id: string;
  recipientEmail: string;
  senderInbox: string;
  leadTimezone: string;
  stepNumber: number;
  dispatchedAt: string | null;
  openedAt: string | null;
  openCount: number;
  repliedAt: string | null;
  status: "REPLIED" | "OPENED" | "SENT" | "SCHEDULED" | "BOUNCED";
}

export interface ClientReportData {
  shareToken: string;
  campaignId: string;
  campaignName: string;
  agencyName: string;
  agencyLogoUrl?: string;
  clientName: string;
  dateRange: string;
  status: "ACTIVE" | "COMPLETED" | "PAUSED";
  metrics: ClientReportMetrics;
  leadActivities: ReportLeadActivity[];
  summaryPoints: string[];
  referralUrl: string;
  generatedAt: string;
}

export interface ReportTokenPayload {
  campaignId: string;
  createdAt: number;
}
