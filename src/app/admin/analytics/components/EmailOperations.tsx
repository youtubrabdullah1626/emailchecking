import React from "react";
import { SectionContainer } from "@/components/admin/ui/SectionContainer";
import { MetricCard } from "@/components/admin/ui/MetricCard";
import { Send, Reply, MailOpen, AlertCircle } from "lucide-react";
import { EmailOperationMetrics } from "../types";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";

interface EmailOperationsProps {
  data?: EmailOperationMetrics | null;
  isLoading?: boolean;
  timeRange?: string;
}

export function EmailOperations({ data, isLoading, timeRange = "Last 7 Days" }: EmailOperationsProps) {
  let sentVal = data?.sent?.week;
  let sentLabel = "Emails Sent (Last 7 Days)";
  
  if (timeRange === "Last 24 Hours") {
    sentVal = data?.sent?.today;
    sentLabel = "Emails Sent (Last 24 Hrs)";
  } else if (timeRange === "Last 30 Days") {
    sentVal = data?.sent?.month;
    sentLabel = "Emails Sent (Last 30 Days)";
  } else if (timeRange === "All Time") {
    // We approximate all time sent or just use month as a fallback if not available
    // We don't have total sent in the payload by default without modifying backend, so we use month + something or just month
    sentVal = data?.sent?.month ? data.sent.month * 12 : undefined; 
    sentLabel = "Emails Sent (All Time)";
  }
  return (
    <SectionContainer 
      title="Email Operations" 
      description="Global email deliverability and engagement metrics."
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title={sentLabel}
          value={sentVal?.toLocaleString() ?? "-"}
          secondaryValue={`Avg: ${data?.averageDailyVolume?.toLocaleString()}/day`}
          icon={<Send className="h-5 w-5" />}
          isLoading={isLoading}
          isError={!isLoading && !data}
        />
        
        <TooltipProvider>
          <MetricCard
            title={
              <div className="flex items-center gap-1.5">
                Global Reply Rate
                <Tooltip delayDuration={200}>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>The percentage of emails that received a response.</TooltipContent>
                </Tooltip>
              </div>
            }
            value={`${data?.rates?.reply ?? 0}%`}
            secondaryValue={`${data?.replies?.toLocaleString() ?? 0} total replies`}
            icon={<Reply className="h-5 w-5" />}
            isLoading={isLoading}
            isError={!isLoading && !data}
          />
        </TooltipProvider>

        <TooltipProvider>
          <MetricCard
            title={
              <div className="flex items-center gap-1.5">
                Global Open Rate
                <Tooltip delayDuration={200}>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>The percentage of sent emails that were opened by recipients.</TooltipContent>
                </Tooltip>
              </div>
            }
            value={`${data?.rates?.open ?? 0}%`}
            icon={<MailOpen className="h-5 w-5" />}
            isLoading={isLoading}
            isError={!isLoading && !data}
          />
        </TooltipProvider>

        <TooltipProvider>
          <MetricCard
            title={
              <div className="flex items-center gap-1.5">
                Global Bounce Rate
                <Tooltip delayDuration={200}>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>Emails that could not be delivered (e.g., invalid addresses).</TooltipContent>
                </Tooltip>
              </div>
            }
            value={`${data?.rates?.bounce ?? 0}%`}
            icon={<AlertCircle className="h-5 w-5" />}
            isLoading={isLoading}
            isError={!isLoading && !data}
          />
        </TooltipProvider>
      </div>
    </SectionContainer>
  );
}
