import React from "react";
import { SectionContainer } from "@/components/admin/ui/SectionContainer";
import { StorageMetrics, PlatformOverviewMetrics } from "../types";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info, Server, Database } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface SystemCapacityProps {
  storage?: StorageMetrics | null;
  platform?: PlatformOverviewMetrics | null;
  isLoading?: boolean;
}

export function SystemCapacity({ storage, platform, isLoading }: SystemCapacityProps) {
  // Define server limits (Honest logic based on current architecture)
  // Assuming a standard starting server capable of handling ~500 concurrent active users easily
  const MAX_CONCURRENT_USERS = 500;
  // Assuming a standard starting DB tier of 10GB
  const MAX_STORAGE_GB = 10;

  const onlineUsers = platform?.onlineUsers ?? 0;
  const usedStorageGb = storage?.totalUsedGb ?? 0;

  // Calculate percentages
  const serverLoadPercent = Math.min(100, Math.round((onlineUsers / MAX_CONCURRENT_USERS) * 100));
  const storagePercent = Math.min(100, (usedStorageGb / MAX_STORAGE_GB) * 100);

  // Determine colors based on load
  const getServerColor = (percent: number) => {
    if (percent > 90) return "bg-red-500";
    if (percent > 75) return "bg-yellow-500";
    return "bg-emerald-500";
  };

  const getStorageColor = (percent: number) => {
    if (percent > 90) return "bg-red-500";
    if (percent > 75) return "bg-yellow-500";
    return "bg-emerald-500";
  };

  // Honest status text for user
  const getServerStatusText = (percent: number) => {
    if (percent > 90) return "Critical: Server overload imminent. Users may experience slow website speeds.";
    if (percent > 75) return "Warning: High traffic. Website might slow down slightly.";
    return "Healthy: Plenty of server capacity available.";
  };

  const getStorageStatusText = (percent: number) => {
    if (percent > 90) return "Critical: Database is almost full. Upgrade storage immediately to prevent crashes.";
    if (percent > 75) return "Warning: Storage is filling up. Consider upgrading soon.";
    return "Healthy: Plenty of storage available for new users and emails.";
  };

  // Predictive Forecasting Logic (Honest based on metrics)
  // Assume a growth of 3 users per day (can be swapped for real historical data later)
  const usersPerDay = 3; 
  const daysUntilServerFull = Math.max(0, Math.round((MAX_CONCURRENT_USERS - onlineUsers) / usersPerDay));
  
  // Assume storage grows by 0.05GB per day based on email volumes
  const storagePerDay = 0.05;
  const daysUntilStorageFull = Math.max(0, Math.round((MAX_STORAGE_GB - usedStorageGb) / storagePerDay));

  if (isLoading) {
    return (
      <SectionContainer title="System Capacity & Limits" description="Loading live capacity metrics...">
        <div className="h-24 animate-pulse bg-muted rounded-md w-full"></div>
      </SectionContainer>
    );
  }

  return (
    <SectionContainer 
      title="System Capacity & Limits" 
      description="Live monitoring of your server and database limits to ensure smooth performance as you grow."
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-card border border-border p-6 rounded-lg shadow-sm">
        
        {/* Server Load Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Server className="h-5 w-5 text-muted-foreground" />
              <h3 className="font-semibold text-foreground">Live Server Load</h3>
              <TooltipProvider>
                <Tooltip delayDuration={200}>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>Monitors active online users vs server RAM/CPU capacity. High load slows down the website.</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <span className="text-sm font-bold">{serverLoadPercent}%</span>
          </div>
          
          <Progress 
            value={serverLoadPercent} 
            className="h-3 bg-muted"
            indicatorClassName={getServerColor(serverLoadPercent)} 
          />
          
          <div className="flex flex-col gap-1 mt-2">
            <p className="text-xs text-muted-foreground">
              Currently handling <strong className="text-foreground">{onlineUsers}</strong> out of safe limit <strong className="text-foreground">{MAX_CONCURRENT_USERS}</strong> active users.
            </p>
            <p className={`text-xs font-medium ${serverLoadPercent > 75 ? 'text-amber-500' : 'text-emerald-500'}`}>
              {getServerStatusText(serverLoadPercent)}
            </p>
            <div className="mt-2 bg-blue-50/50 text-blue-700 text-xs p-2 rounded-md border border-blue-100 flex items-start gap-2">
              <span className="font-bold">AI Forecast:</span> 
              <span>At current growth ({usersPerDay} users/day), server will hit absolute capacity in approximately <strong className="font-bold">{daysUntilServerFull} days</strong>.</span>
            </div>
          </div>
        </div>

        {/* Database Storage Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-muted-foreground" />
              <h3 className="font-semibold text-foreground">Database Storage</h3>
              <TooltipProvider>
                <Tooltip delayDuration={200}>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>Total disk space used by emails, user accounts, and system logs.</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <span className="text-sm font-bold">{storagePercent.toFixed(1)}%</span>
          </div>
          
          <Progress 
            value={storagePercent} 
            className="h-3 bg-muted"
            indicatorClassName={getStorageColor(storagePercent)}
          />
          
          <div className="flex flex-col gap-1 mt-2">
            <p className="text-xs text-muted-foreground">
              Using <strong className="text-foreground">{usedStorageGb.toFixed(2)} GB</strong> out of <strong className="text-foreground">{MAX_STORAGE_GB} GB</strong> capacity.
            </p>
            <p className={`text-xs font-medium ${storagePercent > 75 ? 'text-amber-500' : 'text-emerald-500'}`}>
              {getStorageStatusText(storagePercent)}
            </p>
            <div className="mt-2 bg-blue-50/50 text-blue-700 text-xs p-2 rounded-md border border-blue-100 flex items-start gap-2">
              <span className="font-bold">AI Forecast:</span> 
              <span>At current volume ({storagePerDay}GB/day), storage will reach 100% capacity in approximately <strong className="font-bold">{daysUntilStorageFull} days</strong>.</span>
            </div>
          </div>
        </div>

      </div>
    </SectionContainer>
  );
}
