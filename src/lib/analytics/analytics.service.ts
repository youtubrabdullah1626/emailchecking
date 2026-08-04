import { AnalyticsRepository } from "./analytics.repository";
import { 
  PlatformOverviewMetrics, 
  EmailOperationMetrics, 
  CampaignAnalyticsMetrics,
  AIAnalyticsMetrics,
  InfrastructureHealthMetrics,
  StorageMetrics
} from "@/app/admin/analytics/types";

export interface GlobalAnalyticsPayload {
  platform: PlatformOverviewMetrics | null;
  emails: EmailOperationMetrics | null;
  campaigns: CampaignAnalyticsMetrics | null;
  ai: AIAnalyticsMetrics | null;
  infrastructure: InfrastructureHealthMetrics | null;
  storage: StorageMetrics | null;
  errors: string[];
}

export class AnalyticsService {
  private repository: AnalyticsRepository;

  constructor() {
    this.repository = new AnalyticsRepository();
  }

  /**
   * Orchestrates the aggregation of all global metrics.
   * Uses Promise.allSettled to guarantee graceful degradation.
   * If one subsystem fails, the rest of the dashboard remains operational.
   */
  async getGlobalDashboardMetrics(): Promise<GlobalAnalyticsPayload> {
    const results = await Promise.allSettled([
      this.repository.getPlatformMetrics(),
      this.repository.getEmailMetrics(),
      this.repository.getCampaignMetrics(),
      this.repository.getAiMetrics(),
      this.repository.getInfrastructureMetrics(),
      this.repository.getStorageMetrics()
    ]);

    const errors: string[] = [];
    
    // Helper to safely extract resolved promises
    const extract = <T>(result: PromiseSettledResult<T>, name: string): T | null => {
      if (result.status === "fulfilled") {
        return result.value;
      }
      // In production, log the reason to Observability/Datadog here.
      console.error(`[AnalyticsService] Failed to load ${name}:`, result.reason);
      errors.push(name);
      return null;
    };

    return {
      platform: extract(results[0], "PlatformMetrics"),
      emails: extract(results[1], "EmailMetrics"),
      campaigns: extract(results[2], "CampaignMetrics"),
      ai: extract(results[3], "AiMetrics"),
      infrastructure: extract(results[4], "InfrastructureMetrics"),
      storage: extract(results[5], "StorageMetrics"),
      errors
    };
  }
}
