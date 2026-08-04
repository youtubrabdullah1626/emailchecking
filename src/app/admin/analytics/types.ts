export type HealthStatus = 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'UNKNOWN';

export interface PlatformOverviewMetrics {
  totalUsers: number;
  onlineUsers: number;
  newUsers: { today: number; week: number; month: number };
  overallHealth: HealthStatus;
  lastRefreshAt: string;
}

export interface EmailOperationMetrics {
  sent: { today: number; week: number; month: number };
  averageDailyVolume: number;
  replies: number;
  rates: { reply: number; open: number; bounce: number };
  sequences: { queued: number; running: number; completed: number; paused: number };
}

export interface CampaignAnalyticsMetrics {
  total: number;
  active: number;
  completed: number;
  paused: number;
  rates: { averageReply: number; averageOpen: number; averageCompletion: number };
}

export interface AIAnalyticsMetrics {
  requests: number;
  successRate: number;
  averageResponseTimeMs: number;
  failures: number;
  mostUsedFeature: string;
  usage: { dailyTokens: number; monthlyTokens: number; estimatedCost: number };
}

export interface InfrastructureHealthMetrics {
  database: HealthStatus;
  scheduler: HealthStatus;
  replyScanner: HealthStatus;
  gmailApi: HealthStatus;
  backgroundWorkers: HealthStatus;
}

export interface StorageMetrics {
  databaseSizeGb: number;
  attachmentsSizeGb: number;
  logsSizeGb: number;
  backupsSizeGb: number;
  totalUsedGb: number;
  growthTrendPercent: number;
}
