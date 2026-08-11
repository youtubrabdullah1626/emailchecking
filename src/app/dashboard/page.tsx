"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { apiClient, ApiError } from "@/lib/api-client";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

// UI Components
import { AnimatedPage, AnimatedList, AnimatedItem } from "@/components/ui/animated";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { useSmartExecutiveBannerLogic } from "@/components/ui/smart-executive-banner";
import { Send, Reply, AlertCircle, PlayCircle, Activity } from "lucide-react";

// Existing Types
import type { DashboardStatsData } from "@/components/DashboardStats";

interface RecentEvent {
  id: string;
  eventType: string;
  occurredAt: string;
  prospectName: string;
  company: string;
  stepNumber: number;
  subject: string;
}

interface RecentReply {
  id: string;
  prospectName: string;
  company: string;
  replyType: string;
  replyTime: string;
}

export default function DashboardPage() {
  const [clearedAt, setClearedAt] = useState<number>(0);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("dashboard_recent_replies_cleared_at");
      if (stored) setClearedAt(new Date(stored).getTime());
    }
  }, []);

  const handleClearReplies = () => {
    const nowStr = new Date().toISOString();
    localStorage.setItem("dashboard_recent_replies_cleared_at", nowStr);
    setClearedAt(new Date(nowStr).getTime());
    toast.success("Dashboard cleared of past replies");
  };

  const { data: statsData, error: statsError, isLoading: statsLoading } = useSWR(
    "/api/dashboard/stats", 
    (url: string) => apiClient<any>(url), 
    { refreshInterval: 15000 }
  );

  const { data: repliesData, error: repliesError, isLoading: repliesLoading } = useSWR(
    "/api/replies", 
    (url: string) => apiClient<any>(url).catch(() => ({ replies: [] })), 
    { refreshInterval: 15000 }
  );

  const stats = statsData ? {
    activeSequences: statsData.activeSequences ?? 0,
    emailsSentToday: statsData.emailsSentToday ?? 0,
    totalReplies: statsData.totalReplies ?? 0,
    pendingReviews: statsData.pendingReviews ?? 0,
    failedSteps: statsData.failedSteps ?? 0,
    stoppedSequences: statsData.stoppedSequences ?? 0,
    schedulerStatus: statsData.schedulerStatus ?? "IDLE",
    gmailConfigured: statsData.gmailConfigured ?? false,
    geminiConfigured: statsData.geminiConfigured ?? false,
    schedulerHealth: statsData.schedulerHealth
  } : null;

  const recentEvents: RecentEvent[] = statsData?.recentEvents ?? [];
  const recentReplies: RecentReply[] = (repliesData?.replies ?? []).slice(0, 5);
  const loading = statsLoading || repliesLoading;
  let error = null;
  
  if (statsError || repliesError) {
    const err = statsError || repliesError;
    if (err instanceof ApiError) {
      error = `${err.message}${err.detail ? `: ${err.detail}` : ""}`;
    } else {
      error = err instanceof Error ? err.message : "Failed to load dashboard data.";
    }
  }

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("connected") === "true") {
        const email = params.get("email");
        toast.success(`🎉 ${email ? "Gmail account " + email : "Gmail"} connected successfully! Watch subscription registered and inbox monitoring active.`);
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, []);

  // Derive reply rate
  const replyRate = stats && stats.emailsSentToday > 0 ? Math.round((stats.totalReplies / stats.emailsSentToday) * 100) : 0;

  const bannerState = useSmartExecutiveBannerLogic(stats, recentReplies);

  // Compute specific styling based on priority
  const bannerStyles: Record<number, { glow: string; bg: string; iconBg: string }> = {
    1: { glow: 'bg-blue-500/30', bg: 'bg-card', iconBg: 'bg-blue-500/15 text-blue-700' },
    2: { glow: 'bg-indigo-500/30', bg: 'bg-card', iconBg: 'bg-indigo-500/15 text-indigo-700' },
    3: { glow: 'bg-emerald-500/30', bg: 'bg-card', iconBg: 'bg-emerald-500/15 text-emerald-700' },
    4: { glow: 'bg-amber-500/30', bg: 'bg-card', iconBg: 'bg-amber-500/15 text-amber-700' },
    5: { glow: 'bg-orange-500/30', bg: 'bg-card', iconBg: 'bg-orange-500/15 text-orange-700' },
    6: { glow: 'bg-slate-300/30', bg: 'bg-card', iconBg: 'bg-slate-100 dark:bg-slate-800 text-slate-600' }
  };

  const style = bannerStyles[bannerState.priority] || bannerStyles[6];

  return (
    <AnimatedPage className="space-y-8">
      
      {/* Welcome Header */}
      <div className={`relative flex flex-col md:flex-row gap-6 items-start md:items-center justify-between ${style.bg} border border-border shadow-sm rounded-xl p-6 overflow-hidden`}>
        {/* Ink Spill Glow Effect */}
        <div className={`absolute -left-12 -top-12 h-40 w-40 rounded-full blur-[50px] opacity-70 pointer-events-none ${style.glow}`} />
        
        <div className="flex items-center gap-5 relative z-10">
          <div className={`flex items-center justify-center p-3 rounded-full ${style.iconBg} shadow-sm border border-background/50`}>
            {bannerState.icon}
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">{bannerState.title}</h2>
            <p className="text-muted-foreground mt-1 text-sm flex items-center gap-2">
              {bannerState.message}
              {bannerState.actionLabel && bannerState.actionTarget && (
                <Link prefetch={true} href={bannerState.actionTarget} className="text-primary font-medium hover:underline flex items-center gap-1">
                  {bannerState.actionLabel} &rarr;
                </Link>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Animated Statistics Cards */}
      <AnimatedList className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <AnimatedItem>
          <StatCard 
            title="Active Sequences" 
            value={loading ? "—" : stats?.activeSequences ?? 0}
            icon={<PlayCircle className="h-5 w-5" />}
            trend={stats && stats.activeSequences > 0 ? { value: 12, isPositive: true } : undefined}
          />
        </AnimatedItem>
        <AnimatedItem>
          <StatCard 
            title="Emails Sent Today" 
            value={loading ? "—" : stats?.emailsSentToday ?? 0}
            icon={<Send className="h-5 w-5" />}
          />
        </AnimatedItem>
        <AnimatedItem>
          <StatCard 
            title="Replies Received" 
            value={loading ? "—" : stats?.totalReplies ?? 0}
            icon={<Reply className="h-5 w-5" />}
            trend={stats && stats.totalReplies > 0 ? { value: replyRate, isPositive: true, label: "reply rate" } : undefined}
          />
        </AnimatedItem>
        <AnimatedItem>
          <StatCard 
            title="Pending Reviews" 
            value={loading ? "—" : stats?.pendingReviews ?? 0}
            icon={<AlertCircle className="h-5 w-5" />}
            className={stats?.pendingReviews && stats.pendingReviews > 0 ? "border-amber-200 bg-amber-50/30" : ""}
          />
        </AnimatedItem>
      </AnimatedList>

      {/* Recent Replies & Activity Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 shadow-sm border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="space-y-1">
              <CardTitle>Recent Replies</CardTitle>
              <CardDescription>Latest prospect responses requiring attention</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleClearReplies}>
                Clear
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link prefetch={true} href="/replies">View all</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4 py-4">
                {[1, 2, 3].map(i => <div key={i} className="h-12 bg-muted rounded animate-pulse" />)}
              </div>
            ) : (() => {
              const visibleReplies = recentReplies.filter(r => {
                const replyTime = new Date(r.replyTime).getTime();
                const isNewerThanClear = replyTime > clearedAt;
                const isWithin24Hours = (Date.now() - replyTime) < 24 * 60 * 60 * 1000;
                return isNewerThanClear && isWithin24Hours;
              });
              
              if (visibleReplies.length === 0) {
                return <div className="py-8 text-center text-muted-foreground text-sm">No recent replies today</div>;
              }
              
              return (
                <div className="space-y-1 mt-2">
                  {visibleReplies.map(reply => (
                    <Link prefetch={true} 
                      key={reply.id} 
                      href={`/replies?id=${reply.id}`}
                      className="flex items-center justify-between p-3 hover:bg-muted/50 rounded-lg transition-colors border border-transparent hover:border-border cursor-pointer group"
                    >
                      <div>
                        <p className="font-medium text-sm group-hover:text-primary transition-colors">{reply.prospectName}</p>
                        <p className="text-xs text-muted-foreground">{reply.company}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <StatusBadge status={reply.replyType as any} />
                        <span className="text-xs text-muted-foreground whitespace-nowrap w-24 text-right">
                          {formatDistanceToNow(new Date(reply.replyTime), { addSuffix: true })}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              );
            })()}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border">
          <CardHeader className="pb-2">
            <CardTitle>Activity</CardTitle>
            <CardDescription>Recent system events</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
               <div className="space-y-4 py-4">
               {[1, 2, 3].map(i => <div key={i} className="h-10 bg-muted rounded animate-pulse" />)}
             </div>
            ) : recentEvents.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-sm">No recent activity</div>
            ) : (
              <div className="space-y-4 mt-4">
                {recentEvents.slice(0, 5).map(event => (
                  <div key={event.id} className="flex gap-3 items-start">
                    <div className="mt-0.5 bg-muted p-1.5 rounded-full text-muted-foreground">
                      <Activity className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {event.eventType === "SENT" ? `Sent email to ${event.prospectName}` : 
                         event.eventType === "FAILED" ? `Failed to send to ${event.prospectName}` : 
                         event.eventType === "REPLIED" ? `Reply received from ${event.prospectName}` :
                         event.eventType === "REPLY_CLASSIFIED" ? `Reply classified for ${event.prospectName}` :
                         event.eventType === "AUDIT" ? event.prospectName :
                         `Event for ${event.prospectName}`}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatDistanceToNow(new Date(event.occurredAt), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AnimatedPage>
  );
}

