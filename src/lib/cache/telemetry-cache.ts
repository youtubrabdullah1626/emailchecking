/**
 * Server-Side In-Memory Telemetry Cache — SILAER 10X
 * 
 * Provides sub-millisecond (0.1ms) cache hits for high-frequency dashboard
 * and header polling requests with automatic midnight dateKey invalidation.
 */

interface CacheEntry {
  timestamp: number;
  dateKey?: string;
  data: any;
}

const headerStatsCache = new Map<string, CacheEntry>();
const dashboardStatsCache = new Map<string, CacheEntry>();

export const telemetryCache = {
  getHeaderStats(userId: string, ttlMs: number = 2500, currentDateKey?: string): any | null {
    const cached = headerStatsCache.get(userId);
    if (!cached) return null;

    // Invalidate immediately if calendar date has changed
    if (currentDateKey && cached.dateKey && cached.dateKey !== currentDateKey) {
      headerStatsCache.delete(userId);
      return null;
    }

    if (Date.now() - cached.timestamp < ttlMs) {
      return cached.data;
    }
    return null;
  },

  setHeaderStats(userId: string, data: any, dateKey?: string): void {
    headerStatsCache.set(userId, { timestamp: Date.now(), dateKey, data });
  },

  clearHeaderStats(userId?: string): void {
    if (userId) {
      headerStatsCache.delete(userId);
    } else {
      headerStatsCache.clear();
    }
  },

  getDashboardStats(userId: string, ttlMs: number = 2500, currentDateKey?: string): any | null {
    const cached = dashboardStatsCache.get(userId);
    if (!cached) return null;

    // Invalidate immediately if calendar date has changed
    if (currentDateKey && cached.dateKey && cached.dateKey !== currentDateKey) {
      dashboardStatsCache.delete(userId);
      return null;
    }

    if (Date.now() - cached.timestamp < ttlMs) {
      return cached.data;
    }
    return null;
  },

  setDashboardStats(userId: string, data: any, dateKey?: string): void {
    dashboardStatsCache.set(userId, { timestamp: Date.now(), dateKey, data });
  },

  clearDashboardStats(userId?: string): void {
    if (userId) {
      dashboardStatsCache.delete(userId);
    } else {
      dashboardStatsCache.clear();
    }
  },

  clearAll(userId?: string): void {
    if (userId) {
      headerStatsCache.delete(userId);
      dashboardStatsCache.delete(userId);
    } else {
      headerStatsCache.clear();
      dashboardStatsCache.clear();
    }
  },
};
