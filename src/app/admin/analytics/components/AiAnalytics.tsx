import React from "react";
import { SectionContainer } from "@/components/admin/ui/SectionContainer";
import { MetricCard } from "@/components/admin/ui/MetricCard";
import { ChartContainer } from "@/components/admin/ui/ChartContainer";
import { BrainCircuit, Zap, CheckCircle2, AlertTriangle } from "lucide-react";
import { AIAnalyticsMetrics } from "../types";

interface AiAnalyticsProps {
  data?: AIAnalyticsMetrics | null;
  isLoading?: boolean;
}

export function AiAnalytics({ data, isLoading }: AiAnalyticsProps) {
  const isError = !isLoading && !data;

  return (
    <SectionContainer 
      title="AI Engine Analytics" 
      description="Gemini API utilization, performance, and token usage."
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <MetricCard
          title="Total AI Requests"
          value={data?.requests?.toLocaleString() ?? "-"}
          icon={<BrainCircuit className="h-5 w-5" />}
          isLoading={isLoading}
          isError={isError}
        />
        <MetricCard
          title="Avg Response Time"
          value={`${data?.averageResponseTimeMs ?? 0}ms`}
          icon={<Zap className="h-5 w-5" />}
          isLoading={isLoading}
          isError={isError}
        />
        <MetricCard
          title="Success Rate"
          value={`${data?.successRate ?? 0}%`}
          icon={<CheckCircle2 className="h-5 w-5 text-emerald-500" />}
          isLoading={isLoading}
          isError={isError}
        />
        <MetricCard
          title="AI Failures"
          value={data?.failures?.toLocaleString() ?? "-"}
          icon={<AlertTriangle className="h-5 w-5 text-amber-500" />}
          isLoading={isLoading}
          isError={isError}
        />
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartContainer 
          title="Daily Token Usage" 
          description="Tokens consumed per day over the last 30 days."
          isLoading={isLoading}
          isError={isError}
        />
        <ChartContainer 
          title="Feature Utilization" 
          description="Distribution of AI requests by feature (Reply Parsing, Sequence Generation, etc)."
          isLoading={isLoading}
          isError={isError}
        />
      </div>
    </SectionContainer>
  );
}
