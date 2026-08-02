"use client";

import React from 'react';
import { Card, CardContent } from '@/components/ui';
import { LegacyBadge as Badge } from '@/components/ui/legacy-adapters';
import { StatCard } from '@/components/ui/stat-card';
import { cn } from '@/lib/utils';

export interface SchedulerHealth {
  pendingDueCount: number;
  pendingFutureCount: number;
  processingCount: number;
  staleProcessingCount: number;
  retryEligibleCount: number;
  retriesExhaustedCount: number;
  capturedAt: string;
}

export interface DashboardStatsData {
  activeSequences: number;
  emailsSentToday: number;
  totalReplies: number;
  pendingReviews: number;
  failedSteps: number;
  stoppedSequences: number;
  schedulerStatus: string;
  schedulerHealth?: SchedulerHealth;
  gmailConfigured?: boolean;
  geminiConfigured?: boolean;
}

interface DashboardStatsProps {
  stats: DashboardStatsData;
}

function SchedulerStatusBadge({ status }: { status: string }) {
  const config: Record<string, { variant: "success" | "info" | "warning" | "danger" | "neutral"; label: string }> = {
    IDLE: { variant: "success", label: "IDLE" },
    PROCESSING: { variant: "info", label: "PROCESSING" },
    PENDING_DUE: { variant: "warning", label: "DUE STEPS" },
    STALE_STEPS: { variant: "danger", label: "STALE STEPS ⚠️" },
    HEALTHY: { variant: "success", label: "HEALTHY" },
  };
  const { variant, label } = config[status] ?? { variant: "neutral", label: status };
  return <Badge variant={variant}>{label}</Badge>;
}

function DashboardStatsComponent({ stats }: DashboardStatsProps) {
  const health = stats.schedulerHealth;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
      <StatCard 
        title="Active Sequences" 
        value={stats.activeSequences} 
        icon={<span className="text-xl">✉️</span>} 
        subtitle="Sequences currently running" 
      />
      <StatCard 
        title="Sent Today" 
        value={stats.emailsSentToday} 
        icon={<span className="text-xl">📤</span>} 
        subtitle="Emails delivered since 00:00 UTC" 
      />
      <StatCard 
        title="Total Replies" 
        value={stats.totalReplies} 
        icon={<span className="text-xl">↩️</span>} 
        subtitle="Confirmed prospect replies" 
      />
      <StatCard 
        title="Pending Reviews" 
        value={stats.pendingReviews} 
        icon={<span className="text-xl">⚠️</span>} 
        className={cn(stats.pendingReviews > 0 && "border-primary")}
        badge={stats.pendingReviews > 0 ? <Badge variant="warning">Action Needed</Badge> : null}
        subtitle="Replies requiring operator review" 
      />
      <StatCard 
        title="Stopped Sequences" 
        value={stats.stoppedSequences} 
        icon={<span className="text-xl">🛑</span>} 
        subtitle="Stopped by reply or manual action" 
      />
      <StatCard 
        title="Failed Steps" 
        value={stats.failedSteps} 
        icon={<span className="text-xl">❌</span>} 
        className={cn(stats.failedSteps > 0 && "border-destructive")}
        badge={stats.failedSteps > 0 ? <Badge variant="danger">Retry Available</Badge> : null}
        subtitle={health && health.retryEligibleCount > 0 ? `${health.retryEligibleCount} eligible for retry` : "Steps that failed to send"} 
      />
      
      {/* Scheduler Status Custom Card */}
      <Card className={cn("hover-elevate transition-shadow", stats.schedulerStatus === 'STALE_STEPS' && "border-destructive")}>
        <CardContent className="p-6">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Scheduler</span>
              <div className="bg-muted w-8 h-8 rounded-md flex items-center justify-center text-lg">
                🕐
              </div>
            </div>
            <div className="mt-1">
              <SchedulerStatusBadge status={stats.schedulerStatus} />
            </div>
            <span className="text-xs text-muted-foreground mt-2">
              {health ? `${health.pendingDueCount} due · ${health.processingCount} in-flight` : "Autonomous 15-min cron"}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Integrations Custom Card */}
      <Card className="hover-elevate transition-shadow">
        <CardContent className="p-6">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Integrations</span>
              <div className="bg-muted w-8 h-8 rounded-md flex items-center justify-center text-lg">
                🔗
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-1">
              <Badge variant={stats.gmailConfigured ? "success" : "danger"}>
                {stats.gmailConfigured ? "✓ Gmail" : "✗ Gmail"}
              </Badge>
              <Badge variant={stats.geminiConfigured ? "success" : "neutral"}>
                {stats.geminiConfigured ? "✓ Gemini" : "Gemini (opt.)"}
              </Badge>
            </div>
            <span className="text-xs text-muted-foreground mt-2">
              OAuth & AI configuration
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default React.memo(DashboardStatsComponent);
