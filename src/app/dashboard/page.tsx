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
import { Progress } from "@/components/ui/progress";
import { Send, Reply, AlertCircle, PlayCircle, Target, TrendingUp, Clock, Layers } from "lucide-react";

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
  const [mounted, setMounted] = useState(false);
  const [clearedAt, setClearedAt] = useState<number>(0);

  useEffect(() => {
    setMounted(true);
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
    schedulerHealth: statsData.schedulerHealth,
    dailyLimit: statsData.dailyLimit ?? 500,
    hourlyLimit: statsData.hourlyLimit ?? 50,
    sequenceLimit: statsData.sequenceLimit ?? 5,
    emailsSentThisHour: statsData.emailsSentThisHour ?? 0,
    bannerTheme: statsData.bannerTheme ?? "DEFAULT",
    userTimezone: statsData.userTimezone ?? "UTC"
  } : null;

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
  let style = { glow: 'bg-slate-300/30', bg: 'bg-card', iconBg: 'bg-slate-100 dark:bg-slate-800 text-slate-600' };

  if (bannerState.priority === 1) style = { glow: 'bg-blue-500/30', bg: 'bg-card', iconBg: 'bg-blue-500/15 text-blue-700' };
  else if (bannerState.priority === 2) style = { glow: 'bg-indigo-500/30', bg: 'bg-card', iconBg: 'bg-indigo-500/15 text-indigo-700' };
  else if (bannerState.priority === 3) style = { glow: 'bg-emerald-500/30', bg: 'bg-card', iconBg: 'bg-emerald-500/15 text-emerald-700' };
  else if (bannerState.priority === 4) style = { glow: 'bg-amber-500/30', bg: 'bg-card', iconBg: 'bg-amber-500/15 text-amber-700' };
  else if (bannerState.priority === 5) style = { glow: 'bg-orange-500/30', bg: 'bg-card', iconBg: 'bg-orange-500/15 text-orange-700' };

  // ── Global Theme Override (from Admin Panel) ──────────────────────────────
  const theme = (stats as any)?.bannerTheme || "DEFAULT";
  if (theme === "GREEN") {
    style = { glow: 'bg-emerald-400/40', bg: 'bg-gradient-to-r from-emerald-50/80 to-card', iconBg: 'bg-emerald-100/50 text-emerald-600' };
  } else if (theme === "RED") {
    style = { glow: 'bg-rose-400/40', bg: 'bg-gradient-to-r from-rose-50/80 to-card', iconBg: 'bg-rose-100/50 text-rose-600' };
  } else if (theme === "BLUE") {
    style = { glow: 'bg-blue-400/40', bg: 'bg-gradient-to-r from-blue-50/80 to-card', iconBg: 'bg-blue-100/50 text-blue-600' };
  } else if (theme === "ORANGE") {
    style = { glow: 'bg-orange-400/40', bg: 'bg-gradient-to-r from-orange-50/80 to-card', iconBg: 'bg-orange-100/50 text-orange-600' };
  } else if (theme === "PURPLE") {
    style = { glow: 'bg-purple-400/40', bg: 'bg-gradient-to-r from-purple-50/80 to-card', iconBg: 'bg-purple-100/50 text-purple-600' };
  }

  // Define global safe colors for the platform capacity widget
  let pColor = "text-emerald-600";
  let pBg = "bg-emerald-100/40";
  let pIndicator = "[&>div]:bg-emerald-500";
  let pIconBg = "bg-emerald-100/50 text-emerald-600";
  let pHoverBorder = "hover:border-emerald-200";

  if (theme === "RED") {
    pColor = "text-rose-600"; pBg = "bg-rose-100/40"; pIndicator = "[&>div]:bg-rose-500"; pIconBg = "bg-rose-100/50 text-rose-600"; pHoverBorder = "hover:border-rose-200";
  } else if (theme === "BLUE") {
    pColor = "text-blue-600"; pBg = "bg-blue-100/40"; pIndicator = "[&>div]:bg-blue-500"; pIconBg = "bg-blue-100/50 text-blue-600"; pHoverBorder = "hover:border-blue-200";
  } else if (theme === "ORANGE") {
    pColor = "text-orange-600"; pBg = "bg-orange-100/40"; pIndicator = "[&>div]:bg-orange-500"; pIconBg = "bg-orange-100/50 text-orange-600"; pHoverBorder = "hover:border-orange-200";
  } else if (theme === "PURPLE") {
    pColor = "text-purple-600"; pBg = "bg-purple-100/40"; pIndicator = "[&>div]:bg-purple-500"; pIconBg = "bg-purple-100/50 text-purple-600"; pHoverBorder = "hover:border-purple-200";
  }

  if (!mounted) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <AnimatedPage className="space-y-8">
      
      {/* Welcome Header */}
      <div className={`relative flex flex-col md:flex-row gap-6 items-start md:items-center justify-between ${style.bg} border border-border shadow-sm rounded-xl p-6 overflow-hidden transition-colors duration-500`}>
        {/* Ink Spill Glow Effect */}
        <div className={`absolute -left-12 -top-12 h-40 w-40 rounded-full blur-[50px] opacity-70 pointer-events-none ${style.glow}`} />
        
        <div className="flex items-center gap-5 relative z-10">
          <div className={`flex items-center justify-center p-3 rounded-full ${style.iconBg} shadow-sm border border-background/50`}>
            {bannerState.icon}
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70 drop-shadow-sm">{bannerState.title}</h2>
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
            iconBg={pIconBg}
            className={pHoverBorder}
            trend={stats && stats.activeSequences > 0 ? { value: 12, isPositive: true } : undefined}
          />
        </AnimatedItem>
        <AnimatedItem>
          <StatCard 
            title="Emails Sent Today" 
            value={loading ? "—" : stats?.emailsSentToday ?? 0}
            icon={<Send className="h-5 w-5" />}
            iconBg={pIconBg}
            className={pHoverBorder}
          />
        </AnimatedItem>
        <AnimatedItem>
          <StatCard 
            title="Replies Received" 
            value={loading ? "—" : stats?.totalReplies ?? 0}
            icon={<Reply className="h-5 w-5" />}
            iconBg={pIconBg}
            className={pHoverBorder}
            trend={stats && stats.totalReplies > 0 ? { value: replyRate, isPositive: true, label: "reply rate" } : undefined}
          />
        </AnimatedItem>
        <AnimatedItem>
          <StatCard 
            title="Pending Reviews" 
            value={loading ? "—" : stats?.pendingReviews ?? 0}
            icon={<AlertCircle className="h-5 w-5" />}
            iconBg={pIconBg}
            className={stats?.pendingReviews && stats.pendingReviews > 0 ? "border-amber-200 bg-amber-50/30" : pHoverBorder}
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
                      className="flex items-center justify-between p-3 hover:bg-muted/50 rounded-lg hover:translate-x-1 transition-all duration-300 border border-transparent hover:border-border cursor-pointer group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-xs border border-primary/20 shadow-sm">
                          {reply.prospectName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || '?'}
                        </div>
                        <div>
                          <p className="font-medium text-sm group-hover:text-primary transition-colors">{reply.prospectName}</p>
                          <p className="text-xs text-muted-foreground">{reply.company}</p>
                        </div>
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

        <Card className="shadow-sm border-border flex flex-col">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Platform Capacity</CardTitle>
              <CardDescription>Real-time outreach & velocity limits</CardDescription>
            </div>
            {stats?.userTimezone && (
              <Link 
                href="/settings"
                className="text-[11px] font-medium px-2.5 py-1 rounded-md bg-muted/70 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/60 transition-colors flex items-center gap-1.5 group" 
                title={`Daily reset at midnight (${stats.userTimezone}) • Click to manage in Settings`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 group-hover:scale-125 transition-transform" />
                {stats.userTimezone.split('/').pop()?.replace('_', ' ') || stats.userTimezone}
              </Link>
            )}
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-between">
            {loading || !stats ? (
               <div className="space-y-6 py-4">
                 {[1, 2, 3].map(i => (
                   <div key={i} className="space-y-2">
                     <div className="h-4 bg-muted rounded animate-pulse w-32" />
                     <div className="h-2 bg-muted rounded animate-pulse w-full" />
                   </div>
                 ))}
               </div>
            ) : (() => {
              const renderLimit = (
                icon: React.ReactNode, 
                title: string, 
                current: number, 
                limit: number, 
                isLarge: boolean = false
              ) => {
                const percentage = Math.min(Math.round((current / limit) * 100), 100);
                const isWarning = percentage >= 80;
                const isCritical = percentage >= 95;
                const colorClass = isCritical ? 'text-red-600' : isWarning ? 'text-amber-600' : pColor;
                const bgClass = isCritical ? 'bg-red-100' : isWarning ? 'bg-amber-100' : pBg;
                const indicatorClass = isCritical ? '[&>div]:bg-red-500' : isWarning ? '[&>div]:bg-amber-500' : pIndicator;

                return (
                  <div className={`${isLarge ? 'pb-3 mb-3 border-b border-border/40' : 'mb-3'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className={`p-1.5 rounded-md ${bgClass} ${colorClass}`}>
                          {icon}
                        </div>
                        <div>
                          <p className={`font-bold text-foreground tracking-tight ${isLarge ? 'text-2xl' : 'text-sm'}`}>
                            {current} <span className="text-muted-foreground font-medium text-xs">/ {limit}</span>
                          </p>
                          <p className="text-xs text-muted-foreground">{title}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-bold ${colorClass} ${isLarge ? 'text-lg' : 'text-sm'}`}>
                          {percentage}%
                        </p>
                      </div>
                    </div>
                    <Progress value={percentage} className={`h-1.5 ${pBg} ${indicatorClass}`} />
                  </div>
                );
              };

              const minutesUntilHour = 60 - new Date().getMinutes();

              return (
                <div className="flex flex-col justify-between h-full pt-1">
                  <div>
                    {renderLimit(<Target className="h-4 w-4" />, "Daily Emails Sent", stats.emailsSentToday, stats.dailyLimit, true)}
                    {renderLimit(<Clock className="h-4 w-4" />, "Hourly Velocity", stats.emailsSentThisHour, stats.hourlyLimit)}
                    {renderLimit(<Layers className="h-4 w-4" />, "Active Sequences", stats.activeSequences, stats.sequenceLimit)}
                  </div>
                  <div className="pt-3 mt-1 border-t border-border/40 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-3 w-3 text-primary" /> Velocity reset: <strong>~{minutesUntilHour}m</strong>
                    </span>
                    <span>
                      Daily reset: <strong>00:00</strong>
                    </span>
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      </div>
    </AnimatedPage>
  );
}

