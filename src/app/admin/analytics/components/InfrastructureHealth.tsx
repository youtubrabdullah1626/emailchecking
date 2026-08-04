import React from "react";
import { SectionContainer } from "@/components/admin/ui/SectionContainer";
import { StatusCard } from "@/components/admin/ui/StatusCard";
import { InfrastructureHealthMetrics } from "../types";

interface InfrastructureHealthProps {
  data?: InfrastructureHealthMetrics | null;
  isLoading?: boolean;
}

export function InfrastructureHealth({ data, isLoading }: InfrastructureHealthProps) {
  const isError = !isLoading && !data;

  return (
    <SectionContainer 
      title="Infrastructure & Services" 
      description="Live operational status of core platform subsystems."
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatusCard 
          title="Primary Database" 
          description="PostgreSQL (Supabase)" 
          status={data?.database ?? 'UNKNOWN'} 
          isLoading={isLoading} 
          isError={isError}
        />
        <StatusCard 
          title="Execution Scheduler" 
          description="Cron & Background Jobs" 
          status={data?.scheduler ?? 'UNKNOWN'} 
          isLoading={isLoading} 
          isError={isError}
        />
        <StatusCard 
          title="Reply Scanner Engine" 
          description="IMAP/Gmail Sync" 
          status={data?.replyScanner ?? 'UNKNOWN'} 
          isLoading={isLoading} 
          isError={isError}
        />
        <StatusCard 
          title="Gmail API Gateway" 
          description="OAuth & Sending Limits" 
          status={data?.gmailApi ?? 'UNKNOWN'} 
          isLoading={isLoading} 
          isError={isError}
        />
      </div>
    </SectionContainer>
  );
}
