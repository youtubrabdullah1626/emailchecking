"use client";

import React, { useState } from "react";
import useSWR from "swr";
import { LegacyPageHeader as PageHeader } from "@/components/ui/legacy-adapters";
import { ActionableAlerts } from "./components/ActionableAlerts";
import { PlatformOverview } from "./components/PlatformOverview";
import { EmailOperations } from "./components/EmailOperations";
import { SystemCapacity } from "./components/SystemCapacity";
import { GlobalAnalyticsPayload } from "@/lib/analytics/analytics.service";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Error ${res.status}`);
  }
  return res.json();
};

export default function GlobalAnalyticsDashboard() {
  const [timeRange, setTimeRange] = useState("Last 7 Days");
  const [isLive, setIsLive] = useState(true);

  // Use SWR for intelligent polling and caching
  const { data, error, isLoading } = useSWR<GlobalAnalyticsPayload>(
    "/api/admin/analytics", 
    fetcher,
    {
      refreshInterval: isLive ? 30000 : 0, // Poll every 30s if live
      revalidateOnFocus: isLive,
      dedupingInterval: 10000, // Dedupe calls within 10s
    }
  );

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
      <div className="flex-1 space-y-6 p-8 pt-6 max-w-[1600px] w-full mx-auto">
        <PageHeader
          title="Global Platform Analytics"
          description="Operational command center for platform health, email delivery, and system utilization."
          actions={
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className={isLoading ? "animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" : error ? "absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" : "animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"}></span>
                  <span className={isLoading ? "relative inline-flex rounded-full h-2 w-2 bg-amber-500" : error ? "relative inline-flex rounded-full h-2 w-2 bg-destructive" : isLive ? "relative inline-flex rounded-full h-2 w-2 bg-emerald-500" : "relative inline-flex rounded-full h-2 w-2 bg-slate-400"}></span>
                </span>
                {isLoading ? "Connecting..." : error ? "Offline" : isLive ? "Live Data" : "Paused"}
              </span>
              
              <button 
                onClick={() => setIsLive(!isLive)}
                className={`border text-sm font-medium px-3 py-1.5 rounded-md transition-colors ${
                  isLive ? 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100' : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                }`}
              >
                {isLive ? 'Pause Feed' : 'Resume Feed'}
              </button>

              <select 
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="border border-border rounded-md px-3 py-1.5 text-sm font-medium text-foreground bg-background shadow-sm focus:outline-none focus:ring-1 focus:ring-primary transition-shadow"
              >
                <option value="Last 24 Hours">Last 24 Hours</option>
                <option value="Last 7 Days">Last 7 Days</option>
                <option value="Last 30 Days">Last 30 Days</option>
                <option value="All Time">All Time</option>
              </select>
            </div>
          }
        />

        {/* Global Dashboard Layout Structure */}
        <div className="flex flex-col space-y-12 animate-in fade-in duration-500">
          
          {/* Smart Alerts Section */}
          <ActionableAlerts data={data} isLoading={isLoading} />

          <PlatformOverview data={data?.platform} isLoading={isLoading} timeRange={timeRange} />
          
          <div className="h-px w-full bg-border/50" />
          
          <EmailOperations data={data?.emails} isLoading={isLoading} timeRange={timeRange} />

          <div className="h-px w-full bg-border/50" />
          
          <SystemCapacity platform={data?.platform} storage={data?.storage} isLoading={isLoading} />
        </div>
      </div>
    </div>
  );
}
