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
  summaryPoints: string[];
  referralUrl: string;
  generatedAt: string;
}

export interface ReportTokenPayload {
  campaignId: string;
  createdAt: number;
}
