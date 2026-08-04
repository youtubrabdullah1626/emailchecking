import React from "react";
import { SectionContainer } from "@/components/admin/ui/SectionContainer";
import { MetricCard } from "@/components/admin/ui/MetricCard";
import { Users, UserCheck, UserPlus, Activity } from "lucide-react";
import { PlatformOverviewMetrics } from "../types";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";

interface PlatformOverviewProps {
  data?: PlatformOverviewMetrics | null;
  isLoading?: boolean;
  timeRange?: string;
}

export function PlatformOverview({ data, isLoading, timeRange = "Last 7 Days" }: PlatformOverviewProps) {
  let newUsersVal = data?.newUsers?.week;
  let newUsersLabel = "New Users (Last 7 Days)";
  
  if (timeRange === "Last 24 Hours") {
    newUsersVal = data?.newUsers?.today;
    newUsersLabel = "New Users (Last 24 Hrs)";
  } else if (timeRange === "Last 30 Days") {
    newUsersVal = data?.newUsers?.month;
    newUsersLabel = "New Users (Last 30 Days)";
  } else if (timeRange === "All Time") {
    newUsersVal = data?.totalUsers;
    newUsersLabel = "New Users (All Time)";
  }
  return (
    <SectionContainer 
      title="Platform Overview" 
      description="High-level metrics for user adoption and platform activity."
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <TooltipProvider>
          <MetricCard
            title={
              <div className="flex items-center gap-1.5">
                Total Customers
                <Tooltip delayDuration={200}>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>The total number of registered customers on the platform.</TooltipContent>
                </Tooltip>
              </div>
            }
            value={data?.totalUsers?.toLocaleString() ?? "-"}
            secondaryValue="Across all accounts"
            icon={<Users className="h-5 w-5" />}
            isLoading={isLoading}
            isError={!isLoading && !data}
          />
        </TooltipProvider>
        
        <TooltipProvider>
          <MetricCard
            title={
              <div className="flex items-center gap-1.5">
                Active Now
                <Tooltip delayDuration={200}>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>Customers who have performed an action in the last 15 minutes.</TooltipContent>
                </Tooltip>
              </div>
            }
            value={data?.onlineUsers?.toLocaleString() ?? "-"}
            secondaryValue="Active in last 15m"
            icon={<UserCheck className="h-5 w-5" />}
            isLoading={isLoading}
            isError={!isLoading && !data}
          />
        </TooltipProvider>

        <MetricCard
          title={newUsersLabel}
          value={newUsersVal?.toLocaleString() ?? "-"}
          secondaryValue={`Based on ${timeRange} filter`}
          icon={<UserPlus className="h-5 w-5" />}
          isLoading={isLoading}
          isError={!isLoading && !data}
        />
        
        <TooltipProvider>
          <MetricCard
            title={
              <div className="flex items-center gap-1.5">
                System Status
                <Tooltip delayDuration={200}>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>Indicates if all internal background services are running smoothly.</TooltipContent>
                </Tooltip>
              </div>
            }
            value={data?.overallHealth ?? "-"}
            secondaryValue="All systems operational"
            icon={<Activity className="h-5 w-5 text-emerald-500" />}
            isLoading={isLoading}
            isError={!isLoading && !data}
          />
        </TooltipProvider>
      </div>
    </SectionContainer>
  );
}
