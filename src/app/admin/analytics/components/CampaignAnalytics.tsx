import React from "react";
import { SectionContainer } from "@/components/admin/ui/SectionContainer";
import { MetricCard } from "@/components/admin/ui/MetricCard";
import { ChartContainer } from "@/components/admin/ui/ChartContainer";
import { Target, PlayCircle, CheckCircle2, PauseCircle } from "lucide-react";
import { CampaignAnalyticsMetrics } from "../types";

interface CampaignAnalyticsProps {
  data?: CampaignAnalyticsMetrics | null;
  isLoading?: boolean;
}

export function CampaignAnalytics({ data, isLoading }: CampaignAnalyticsProps) {
  const isError = !isLoading && !data;
  
  return (
    <SectionContainer 
      title="Campaign Analytics" 
      description="Overall progression and state of automated sequences."
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 flex flex-col gap-4">
          <MetricCard
            title="Total Campaigns"
            value={data?.total?.toLocaleString() ?? "-"}
            secondaryValue="All time"
            icon={<Target className="h-5 w-5" />}
            isLoading={isLoading}
            isError={isError}
          />
          <MetricCard
            title="Active Campaigns"
            value={data?.active?.toLocaleString() ?? "-"}
            icon={<PlayCircle className="h-5 w-5 text-blue-500" />}
            isLoading={isLoading}
            isError={isError}
          />
          <MetricCard
            title="Completed Campaigns"
            value={data?.completed?.toLocaleString() ?? "-"}
            icon={<CheckCircle2 className="h-5 w-5 text-emerald-500" />}
            isLoading={isLoading}
            isError={isError}
          />
          <MetricCard
            title="Paused Campaigns"
            value={data?.paused?.toLocaleString() ?? "-"}
            icon={<PauseCircle className="h-5 w-5 text-amber-500" />}
            isLoading={isLoading}
            isError={isError}
          />
        </div>
        <div className="lg:col-span-2 flex">
          <ChartContainer 
            title="Campaign Progression Funnel" 
            description="Aggregate view of sequence conversion rates across the platform."
            isLoading={isLoading}
            isError={isError}
            className="w-full h-full"
          />
        </div>
      </div>
    </SectionContainer>
  );
}
