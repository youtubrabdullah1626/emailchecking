"use client";

import { preload } from "swr";
import { apiClient } from "@/lib/api-client";

// Mapping of routes to their primary API data endpoints for smart pre-warming
export const ROUTE_API_PRELOAD_MAP: Record<string, string[]> = {
  "/dashboard": ["/api/dashboard/stats", "/api/dashboard/header-stats", "/api/notifications/important"],
  "/prospects": ["/api/prospects?limit=500"],
  "/sequences": ["/api/sequences"],
  "/smart-import": ["/api/campaigns", "/api/dashboard/header-stats"],
  "/timeline": ["/api/timeline?search=&status=ALL&timeRange=all&page=1&limit=50"],
  "/replies": ["/api/replies"],
  "/settings": ["/api/dashboard/header-stats"],
  "/admin/announcements": ["/api/admin/announcements"],
  "/admin/import-history": ["/api/admin/import-history?page=1&limit=20"],
  "/admin/platform": ["/api/admin/platform/configs?environment=production", "/api/admin/platform/flags?environment=production", "/api/admin/platform/providers?environment=production"],
  "/admin/feedback": ["/api/admin/feedback"],
  "/admin/users": ["/api/admin/users"],
  "/admin/analytics": ["/api/admin/analytics"],
  "/admin/database-cleanup": ["/api/admin/system/db-maintenance"],
};

// Set to avoid redundant preloads within short intervals
const preloadedCache = new Set<string>();

const defaultFetcher = (url: string) => apiClient<any>(url).catch(() => null);

/**
 * Smart Predictive Route & SWR Cache Pre-warmer
 * Preloads both the Next.js JavaScript page chunks and the SWR backend data
 * as soon as the user hovers over a link or button.
 */
export function prewarmRouteData(href: string) {
  if (typeof window === "undefined" || !href) return;

  // Clean pathname
  const pathname = href.split("?")[0].split("#")[0];
  const endpoints = ROUTE_API_PRELOAD_MAP[pathname];

  if (endpoints && endpoints.length > 0) {
    endpoints.forEach(endpoint => {
      const cacheKey = `${pathname}::${endpoint}`;
      if (!preloadedCache.has(cacheKey)) {
        preloadedCache.add(cacheKey);
        
        // Use SWR preload to prime the cache
        try {
          preload(endpoint, defaultFetcher);
        } catch {
          // Silent fallback
        }

        // Expire preload dedupe after 30 seconds
        setTimeout(() => {
          preloadedCache.delete(cacheKey);
        }, 30000);
      }
    });
  }
}
