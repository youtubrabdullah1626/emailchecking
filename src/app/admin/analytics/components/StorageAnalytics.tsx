import React from "react";
import { SectionContainer } from "@/components/admin/ui/SectionContainer";
import { MetricCard } from "@/components/admin/ui/MetricCard";
import { HardDrive, Database, FileText, Archive } from "lucide-react";
import { StorageMetrics } from "../types";

interface StorageAnalyticsProps {
  data?: StorageMetrics | null;
  isLoading?: boolean;
}

export function StorageAnalytics({ data, isLoading }: StorageAnalyticsProps) {
  const isError = !isLoading && !data;

  return (
    <SectionContainer 
      title="Storage & Data" 
      description="Database consumption and file storage utilization."
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Storage Used"
          value={`${data?.totalUsedGb ?? 0} GB`}
          icon={<HardDrive className="h-5 w-5" />}
          isLoading={isLoading}
          isError={isError}
        />
        <MetricCard
          title="PostgreSQL Database"
          value={`${data?.databaseSizeGb ?? 0} GB`}
          icon={<Database className="h-5 w-5 text-blue-500" />}
          isLoading={isLoading}
          isError={isError}
        />
        <MetricCard
          title="Attachments & Media"
          value={`${data?.attachmentsSizeGb ?? 0} GB`}
          icon={<FileText className="h-5 w-5 text-indigo-500" />}
          isLoading={isLoading}
          isError={isError}
        />
        <MetricCard
          title="System Logs & Backups"
          value={`${data?.logsSizeGb ?? 0} GB`}
          icon={<Archive className="h-5 w-5 text-slate-500" />}
          isLoading={isLoading}
          isError={isError}
        />
      </div>
    </SectionContainer>
  );
}
