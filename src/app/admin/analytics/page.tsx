"use client";

import React, { useState, useEffect } from "react";
import useSWR from "swr";
import { Activity, Info, Sparkles, RefreshCw, Radio } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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

  const [cachedAnalytics, setCachedAnalytics] = useState<any>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("silaer_cached_admin_analytics");
      if (raw) setCachedAnalytics(JSON.parse(raw));
    } catch {}
  }, []);

  // Use SWR for intelligent polling and caching
  const { data: rawData, error, isLoading: swrLoading } = useSWR<GlobalAnalyticsPayload>(
    "/api/admin/analytics", 
    fetcher,
    {
      refreshInterval: isLive ? 30000 : 0,
      revalidateOnFocus: isLive,
      dedupingInterval: 5000,
      keepPreviousData: true,
      onSuccess: (resData) => {
        if (resData && typeof window !== "undefined") {
          try {
            localStorage.setItem("silaer_cached_admin_analytics", JSON.stringify(resData));
          } catch {}
        }
      },
    }
  );

  const data = rawData || cachedAnalytics;
  const isLoading = swrLoading && !data;

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Signature Silaer Dynamic Header Banner */}
      <div className="bg-gradient-to-r from-primary/15 via-primary/5 to-card border border-primary/20 rounded-2xl p-5 md:p-6 shadow-xs relative overflow-hidden transition-colors duration-300">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start sm:items-center gap-4">
            <div className="h-11 w-11 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0 border border-primary/25 shadow-xs">
              <Activity className="h-5 w-5" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                  Global Platform Analytics
                </h1>
                <TooltipProvider>
                  <Tooltip delayDuration={200}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="flex items-center justify-center h-5 w-5 rounded-full bg-primary/15 text-primary hover:bg-primary/25 transition-colors cursor-help"
                      >
                        <Info className="h-3 w-3" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" align="center" className="max-w-xs p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl rounded-xl z-50 text-xs">
                      <p className="font-semibold text-slate-900 dark:text-white mb-1">
                        Operational Command Center
                      </p>
                      <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                        Live monitoring of outreach delivery, open & reply rates, sequence velocity, and server resource health.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                Real-time command center for platform health, email velocity, and outreach conversion.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 self-start md:self-center">
            {/* Live Indicator */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/80 dark:bg-slate-900 border border-orange-200/80 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 shadow-2xs">
              <span className="relative flex h-2 w-2">
                <span className={isLoading ? "animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" : error ? "absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" : "animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"}></span>
                <span className={isLoading ? "relative inline-flex rounded-full h-2 w-2 bg-amber-500" : error ? "relative inline-flex rounded-full h-2 w-2 bg-rose-500" : isLive ? "relative inline-flex rounded-full h-2 w-2 bg-emerald-500" : "relative inline-flex rounded-full h-2 w-2 bg-slate-400"}></span>
              </span>
              <span>{isLoading ? "Connecting..." : error ? "Offline" : isLive ? "Live Data" : "Paused"}</span>
            </div>

            <button 
              onClick={() => setIsLive(!isLive)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all shadow-2xs ${
                isLive 
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60' 
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800'
              }`}
            >
              {isLive ? 'Pause Feed' : 'Resume Feed'}
            </button>

            <select 
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="border border-orange-200/80 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 bg-white/90 dark:bg-slate-900 shadow-2xs focus:outline-none focus:ring-2 focus:ring-orange-500/20"
            >
              <option value="Last 24 Hours">Last 24 Hours</option>
              <option value="Last 7 Days">Last 7 Days</option>
              <option value="Last 30 Days">Last 30 Days</option>
              <option value="All Time">All Time</option>
            </select>
          </div>
        </div>
      </div>

      {/* Global Dashboard Layout Structure */}
      <div className="flex flex-col space-y-8">
        {/* Smart Alerts Section */}
        <ActionableAlerts data={data} isLoading={isLoading} />

        <PlatformOverview data={data?.platform} isLoading={isLoading} timeRange={timeRange} />
        
        <div className="h-px w-full bg-slate-200/60 dark:bg-slate-800/60" />
        
        <EmailOperations data={data?.emails} isLoading={isLoading} timeRange={timeRange} />

        <div className="h-px w-full bg-slate-200/60 dark:bg-slate-800/60" />
        
        <SystemCapacity platform={data?.platform} storage={data?.storage} isLoading={isLoading} />
      </div>
    </div>
  );
}
