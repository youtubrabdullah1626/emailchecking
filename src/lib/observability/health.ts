import prisma from "@/lib/prisma";
import { logger } from "./logger";

export type HealthState = "HEALTHY" | "WARNING" | "DEGRADED" | "CRITICAL";

export interface ComponentHealth {
  status: HealthState;
  message?: string;
  lastChecked: string;
}

export interface SystemHealthReport {
  overall: HealthState;
  components: {
    database: ComponentHealth;
    gmailOauth: ComponentHealth;
    gmailWatch: ComponentHealth;
    scheduler: ComponentHealth;
  };
  metrics: {
    uptime: number;
    memoryUsageMb: number;
    activeConnections: number;
  };
}

export class HealthMonitoringService {
  private determineOverallStatus(components: Record<string, ComponentHealth>): HealthState {
    const states = Object.values(components).map((c) => c.status);
    if (states.includes("CRITICAL")) return "CRITICAL";
    if (states.includes("DEGRADED")) return "DEGRADED";
    if (states.includes("WARNING")) return "WARNING";
    return "HEALTHY";
  }

  public async getSystemHealth(): Promise<SystemHealthReport> {
    const components: SystemHealthReport["components"] = {
      database: { status: "HEALTHY", lastChecked: new Date().toISOString() },
      gmailOauth: { status: "HEALTHY", lastChecked: new Date().toISOString() },
      gmailWatch: { status: "HEALTHY", lastChecked: new Date().toISOString() },
      scheduler: { status: "HEALTHY", lastChecked: new Date().toISOString() },
    };

    // 1. Database Health
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (e) {
      components.database.status = "CRITICAL";
      components.database.message = "Database unreachable";
      logger.critical("HealthCheck: Database unreachable", { error: e });
    }

    // 2. Gmail OAuth & Watch Health (Aggregate from DB)
    if (components.database.status === "HEALTHY") {
      try {
        const accounts = await prisma.emailAccount.findMany({ select: { connection_status: true } });
        const disconnected = accounts.filter(a => a.connection_status !== "CONNECTED");
        if (accounts.length > 0 && disconnected.length > 0) {
          components.gmailOauth.status = disconnected.length === accounts.length ? "CRITICAL" : "DEGRADED";
          components.gmailOauth.message = `${disconnected.length}/${accounts.length} accounts disconnected`;
        }

        const watches = await prisma.gmailWatchState.findMany({ select: { health_status: true, expiration: true } });
        const now = Date.now();
        let watchIssues = 0;
        watches.forEach(w => {
          if (w.health_status !== "HEALTHY" || Number(w.expiration) < now) watchIssues++;
        });

        if (watches.length > 0 && watchIssues > 0) {
          components.gmailWatch.status = watchIssues === watches.length ? "CRITICAL" : "DEGRADED";
          components.gmailWatch.message = `${watchIssues}/${watches.length} watches failing or expired`;
        }
      } catch (e) {
         logger.error("HealthCheck: Failed to evaluate Gmail status", { error: e });
      }
    }

    // 3. Scheduler Health (Check if any steps are stuck in PROCESSING for > 15 mins)
    if (components.database.status === "HEALTHY") {
      try {
        const stuckThreshold = new Date(Date.now() - 15 * 60 * 1000);
        const stuckJobs = await prisma.sequenceStep.count({
          where: { status: "PROCESSING", sent_at: null }
        });
        
        // As we don't have a specific `updated_at` for steps, if there are ANY processing jobs, 
        // it MIGHT just be running. But if there are too many (e.g. > 50), it's likely a stuck queue.
        if (stuckJobs > 50) {
           components.scheduler.status = "WARNING";
           components.scheduler.message = "High number of steps in PROCESSING state";
        }
      } catch (e) {
         logger.error("HealthCheck: Failed to evaluate Scheduler", { error: e });
      }
    }

    const memoryUsage = process.memoryUsage();

    return {
      overall: this.determineOverallStatus(components),
      components,
      metrics: {
        uptime: process.uptime(),
        memoryUsageMb: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        activeConnections: 0, // Would require custom pg tracking
      },
    };
  }
}

export const healthMonitor = new HealthMonitoringService();
