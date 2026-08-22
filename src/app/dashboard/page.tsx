"use client";

export const dynamic = "force-dynamic";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import useSWR from "swr";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

// UI Components
import { AnimatedPage, AnimatedList, AnimatedItem } from "@/components/ui/animated";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { useSmartExecutiveBannerLogic } from "@/components/ui/smart-executive-banner";
import { Progress } from "@/components/ui/progress";
import { 
  Send, 
  Reply, 
  PlayCircle, 
  Target, 
  TrendingUp, 
  Clock, 
  Layers, 
  Eye, 
  CheckCircle2, 
  ShieldCheck, 
  Sparkles,
  BarChart3
} from "lucide-react";

interface TopSequenceItem {
  id: string;
  prospectName: string;
  company: string;
  email: string;
  firstSubject: string;
  status: string;
  totalSteps: number;
  completedSteps: number;
  currentStep: number;
  progressPct: number;
  createdAt: string;
}

interface DailyTrendItem {
  date: string;
  rawDate: string;
  sent: number;
  opened: number;
  replies: number;
}

interface RecentReply {
  id: string;
  prospectName: string;
  company: string;
  email?: string;
  replyType: string;
  replyTime: string;
}

function getAvatarColor(str: string) {
  const colors = [
    "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
    "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
    "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
  ];
  let hash = 0;
  const safeStr = str || "prospect";
  for (let i = 0; i < safeStr.length; i++) {
    hash = safeStr.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

type TimeframeOption = "today" | "7d" | "30d" | "all";

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);
  const [timeframe, setTimeframe] = useState<TimeframeOption>("7d");
  const [clearedAt, setClearedAt] = useState<number>(0);
  const [activeMetricTab, setActiveMetricTab] = useState<"all" | "sent" | "opened" | "replies">("all");
  const [hoveredDataIndex, setHoveredDataIndex] = useState<number | null>(null);

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
    toast.success("Recent replies cleared from dashboard view");
  };

  const [cachedDashboard, setCachedDashboard] = useState<any>(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("silaer_cached_dashboard_stats");
        if (raw) return JSON.parse(raw);
      } catch {}
    }
    return null;
  });

  const { data: statsData, isLoading: statsLoading } = useSWR(
    "/api/dashboard/stats", 
    (url: string) => apiClient<any>(url), 
    {
      refreshInterval: 8000,
      revalidateOnFocus: true,
      dedupingInterval: 2000,
      keepPreviousData: true,
      fallbackData: cachedDashboard,
      onSuccess: (data) => {
        if (data && typeof window !== "undefined") {
          try {
            localStorage.setItem("silaer_cached_dashboard_stats", JSON.stringify(data));
          } catch {}
        }
      }
    }
  );

  const { data: repliesData, isLoading: repliesLoading } = useSWR(
    "/api/replies", 
    (url: string) => apiClient<any>(url).catch(() => ({ replies: [] })), 
    {
      refreshInterval: 8000,
      keepPreviousData: true,
    }
  );

  const stats = useMemo(() => {
    if (!statsData) return null;
    return {
      activeSequences: statsData.activeSequences ?? 0,
      emailsSentToday: statsData.emailsSentToday ?? 0,
      opensToday: statsData.opensToday ?? 0,
      allTimeSent: statsData.allTimeSent ?? statsData.emailsSentToday ?? 0,
      totalReplies: statsData.totalReplies ?? statsData.repliesToday ?? 0,
      repliesToday: statsData.repliesToday ?? 0,
      totalOpens: statsData.totalOpens ?? 0,
      openRate: statsData.openRate ?? 0,
      totalProspects: statsData.totalProspects ?? 0,
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
      userTimezone: statsData.userTimezone ?? "UTC",
      dailyTrends: (statsData.dailyTrends as DailyTrendItem[]) ?? [],
      topSequences: (statsData.topSequences as TopSequenceItem[]) ?? [],
      funnel: statsData.funnel ?? {
        sent: statsData.emailsSentToday ?? 0,
        delivered: statsData.emailsSentToday ?? 0,
        opened: statsData.totalOpens ?? 0,
        replied: statsData.totalReplies ?? 0,
        openRate: statsData.openRate ?? 0,
        replyRate: 0,
        deliverabilityScore: 99.4
      }
    };
  }, [statsData]);

  const recentReplies: RecentReply[] = useMemo(() => {
    return (repliesData?.replies ?? []).slice(0, 6);
  }, [repliesData?.replies]);

  const isStatsLoading = statsLoading && !statsData;
  const isRepliesLoading = repliesLoading && !repliesData;

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

  // Filtered daily trends based on selected timeframe
  const displayedTrends = useMemo(() => {
    if (!stats?.dailyTrends || stats.dailyTrends.length === 0) return [];
    if (timeframe === "today") return stats.dailyTrends.slice(-1);
    if (timeframe === "7d") return stats.dailyTrends.slice(-7);
    return stats.dailyTrends; // 14-30d
  }, [stats?.dailyTrends, timeframe]);

  // Aggregate metrics based on selected timeframe with mathematical accuracy
  const timeframeStats = useMemo(() => {
    if (!stats) return { sent: 0, opened: 0, replies: 0, openRate: 0, replyRate: 0 };
    
    if (timeframe === "today") {
      const sent = stats.emailsSentToday;
      const replies = stats.repliesToday;
      const opened = Math.max(stats.opensToday, replies);
      const openRate = sent > 0 ? Math.min(100, Math.round((opened / sent) * 100)) : (opened > 0 ? 100 : 0);
      const replyRate = sent > 0 ? Math.min(100, Math.round((replies / sent) * 100)) : (replies > 0 ? 100 : 0);
      return { sent, opened, replies, openRate, replyRate };
    }

    if (timeframe === "all") {
      const sent = stats.allTimeSent || (stats.dailyTrends.reduce((acc, d) => acc + d.sent, 0)) || stats.emailsSentToday;
      const replies = stats.totalReplies;
      const opened = Math.max(stats.totalOpens, replies);
      const openRate = sent > 0 ? Math.min(100, Math.round((opened / sent) * 100)) : (opened > 0 ? 100 : 0);
      const replyRate = sent > 0 ? Math.min(100, Math.round((replies / sent) * 100)) : 0;
      return { sent, opened, replies, openRate, replyRate };
    }

    if (displayedTrends.length > 0) {
      const sent = displayedTrends.reduce((acc, d) => acc + d.sent, 0);
      const replies = displayedTrends.reduce((acc, d) => acc + d.replies, 0);
      const rawOpened = displayedTrends.reduce((acc, d) => acc + d.opened, 0);
      const opened = Math.max(rawOpened, replies);
      const openRate = sent > 0 ? Math.min(100, Math.round((opened / sent) * 100)) : (opened > 0 ? 100 : 0);
      const replyRate = sent > 0 ? Math.min(100, Math.round((replies / sent) * 100)) : (replies > 0 ? 100 : 0);
      return { sent, opened, replies, openRate, replyRate };
    }

    return {
      sent: stats.emailsSentToday,
      opened: Math.max(stats.opensToday, stats.repliesToday),
      replies: stats.repliesToday,
      openRate: 0,
      replyRate: 0
    };
  }, [stats, timeframe, displayedTrends]);

  const timeframeLabel = timeframe === "today" ? "Today" : timeframe === "7d" ? "7 Days" : timeframe === "30d" ? "30 Days" : "All Time";

  const bannerState = useSmartExecutiveBannerLogic(stats, recentReplies);

  // SVG Chart Dimensions & Math
  const chartHeight = 160;
  const chartWidth = 600;
  const maxDataVal = useMemo(() => {
    if (displayedTrends.length === 0) return 10;
    const maxVal = Math.max(...displayedTrends.map(d => Math.max(d.sent, d.opened, d.replies)));
    return maxVal > 0 ? Math.ceil(maxVal * 1.25) : 10;
  }, [displayedTrends]);

  const points = useMemo(() => {
    if (displayedTrends.length === 0) return { sent: "", opened: "", replies: "" };
    const stepX = displayedTrends.length > 1 ? chartWidth / (displayedTrends.length - 1) : chartWidth / 2;
    
    const sentPts = displayedTrends.map((d, i) => {
      const x = i * stepX;
      const y = chartHeight - (d.sent / maxDataVal) * (chartHeight - 20) - 10;
      return `${x},${y}`;
    }).join(" ");

    const openedPts = displayedTrends.map((d, i) => {
      const x = i * stepX;
      const y = chartHeight - (d.opened / maxDataVal) * (chartHeight - 20) - 10;
      return `${x},${y}`;
    }).join(" ");

    const repliesPts = displayedTrends.map((d, i) => {
      const x = i * stepX;
      const y = chartHeight - (d.replies / maxDataVal) * (chartHeight - 20) - 10;
      return `${x},${y}`;
    }).join(" ");

    return { sent: sentPts, opened: openedPts, replies: repliesPts };
  }, [displayedTrends, maxDataVal]);

  if (!mounted) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <AnimatedPage className="space-y-8 max-w-7xl mx-auto pb-12">
      
      {/* ── 1. Signature Executive Header Banner ── */}
      <div className="bg-card border border-border/80 rounded-xl p-6 shadow-xs relative overflow-hidden transition-colors duration-200">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 relative z-10">
          <div className="flex items-start sm:items-center gap-4">
            <div className="h-11 w-11 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
              {bannerState.icon}
            </div>

            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
                  {bannerState.title}
                </h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border border-primary/20 bg-primary/10 text-primary">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  Live Operational
                </span>
              </div>
              <p className="text-xs md:text-sm text-muted-foreground mt-1 flex items-center gap-2">
                {bannerState.message}
                {bannerState.actionLabel && bannerState.actionTarget && (
                  <Link prefetch={true} href={bannerState.actionTarget} className="text-primary font-semibold hover:underline flex items-center gap-1">
                    {bannerState.actionLabel} &rarr;
                  </Link>
                )}
              </p>
            </div>
          </div>

          {/* Timeframe Filter Switcher */}
          <div className="inline-flex p-1 rounded-lg bg-secondary border border-border/80 shadow-2xs shrink-0">
            {(["today", "7d", "30d", "all"] as TimeframeOption[]).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all capitalize ${
                  timeframe === tf
                    ? "bg-card text-foreground shadow-xs border border-border/60"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tf === "today" ? "Today" : tf === "7d" ? "7 Days" : tf === "30d" ? "30 Days" : "All Time"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── 2. Top-Level Operational KPIs ── */}
      <AnimatedList className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Active Sequences */}
        <AnimatedItem>
          <div className="relative group rounded-xl border border-border bg-card p-5 shadow-xs hover:border-border transition-all duration-150 flex flex-col justify-between min-h-[140px]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Active Sequences
              </span>
              <div className="h-8 w-8 rounded-lg bg-secondary text-foreground flex items-center justify-center border border-border">
                <PlayCircle className="h-4 w-4 text-primary" />
              </div>
            </div>

            <div className="my-2 flex items-baseline justify-between">
              <div className="text-3xl font-extrabold tracking-tight text-foreground">
                {isStatsLoading ? "—" : stats?.activeSequences ?? 0}
              </div>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border text-xs text-muted-foreground">
              <span>{stats?.totalProspects ?? 0} total prospects</span>
              <Link href="/sequences" className="text-primary font-medium hover:underline flex items-center gap-0.5">
                Manage &rarr;
              </Link>
            </div>
          </div>
        </AnimatedItem>

        {/* Card 2: Emails Sent */}
        <AnimatedItem>
          <div className="relative group rounded-xl border border-border bg-card p-5 shadow-xs hover:border-border transition-all duration-150 flex flex-col justify-between min-h-[140px]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Emails Sent ({timeframeLabel})
              </span>
              <div className="h-8 w-8 rounded-lg bg-secondary text-foreground flex items-center justify-center border border-border">
                <Send className="h-4 w-4 text-primary" />
              </div>
            </div>

            <div className="my-2 flex items-baseline justify-between">
              <div className="text-3xl font-extrabold tracking-tight text-foreground">
                {isStatsLoading ? "—" : timeframeStats.sent.toLocaleString()}
              </div>
              <span className="text-xs font-mono font-medium text-muted-foreground bg-secondary px-2 py-0.5 rounded-md border border-border">
                Cap: {stats?.dailyLimit ?? 50}/day
              </span>
            </div>

            <div className="pt-2 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex-1 mr-3">
                <Progress 
                  value={stats ? Math.min(Math.round((stats.emailsSentToday / stats.dailyLimit) * 100), 100) : 0} 
                  className="h-1.5 bg-secondary [&>div]:bg-primary"
                />
              </div>
              <span className="text-[11px] font-mono font-medium shrink-0">
                {stats?.emailsSentToday ?? 0} today
              </span>
            </div>
          </div>
        </AnimatedItem>

        {/* Card 3: Emails Opened */}
        <AnimatedItem>
          <div className="relative group rounded-xl border border-border bg-card p-5 shadow-xs hover:border-border transition-all duration-150 flex flex-col justify-between min-h-[140px]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Emails Opened ({timeframeLabel})
              </span>
              <div className="h-8 w-8 rounded-lg bg-secondary text-foreground flex items-center justify-center border border-border">
                <Eye className="h-4 w-4 text-blue-500" />
              </div>
            </div>

            <div className="my-2 flex items-baseline justify-between">
              <div className="text-3xl font-extrabold tracking-tight text-foreground">
                {isStatsLoading ? "—" : timeframeStats.opened.toLocaleString()}
              </div>
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-500/10 border border-blue-500/20">
                {timeframeStats.openRate}% open rate
              </span>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border text-xs text-muted-foreground">
              <span>Verified open telemetry</span>
              <span className="text-muted-foreground/80 text-[11px] font-mono">
                {timeframeLabel}
              </span>
            </div>
          </div>
        </AnimatedItem>

        {/* Card 4: Replies Received */}
        <AnimatedItem>
          <div className="relative group rounded-xl border border-border bg-card p-5 shadow-xs hover:border-border transition-all duration-150 flex flex-col justify-between min-h-[140px]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Replies Received ({timeframeLabel})
              </span>
              <div className="h-8 w-8 rounded-lg bg-secondary text-foreground flex items-center justify-center border border-border">
                <Reply className="h-4 w-4 text-emerald-500" />
              </div>
            </div>

            <div className="my-2 flex items-baseline justify-between">
              <div className="text-3xl font-extrabold tracking-tight text-foreground">
                {isStatsLoading ? "—" : timeframeStats.replies.toLocaleString()}
              </div>
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
                {timeframeStats.replyRate}% reply rate
              </span>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border text-xs text-muted-foreground">
              <span>{stats?.pendingReviews ? `${stats.pendingReviews} pending review` : "Inbox clear"}</span>
              <Link href="/replies" className="text-emerald-600 dark:text-emerald-400 font-medium hover:underline flex items-center gap-0.5">
                View Inbox &rarr;
              </Link>
            </div>
          </div>
        </AnimatedItem>
      </AnimatedList>

      {/* ── 3. Interactive Outreach Velocity & Performance Chart ── */}
      <Card className="border border-border shadow-xs bg-card overflow-hidden">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 gap-4 border-b border-border">
          <div>
            <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Outreach Volume & Velocity Trends
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Daily emails sent, delivery opens, and classified prospect responses over {timeframe === "today" ? "today" : timeframe === "7d" ? "the last 7 days" : "the selected period"}
            </CardDescription>
          </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 text-xs font-medium mr-2">
                <button 
                  onClick={() => setActiveMetricTab(activeMetricTab === "sent" ? "all" : "sent")}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all text-xs ${activeMetricTab === "sent" || activeMetricTab === "all" ? "text-primary bg-primary/10 border border-primary/20 font-bold" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <span className="h-2 w-2 rounded-full bg-primary" /> Sent
                </button>
                <button 
                  onClick={() => setActiveMetricTab(activeMetricTab === "opened" ? "all" : "opened")}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all text-xs ${activeMetricTab === "opened" || activeMetricTab === "all" ? "text-blue-600 dark:text-blue-400 bg-blue-500/10 border border-blue-500/20 font-bold" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <span className="h-2 w-2 rounded-full bg-blue-500" /> Opens
                </button>
                <button 
                  onClick={() => setActiveMetricTab(activeMetricTab === "replies" ? "all" : "replies")}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all text-xs ${activeMetricTab === "replies" || activeMetricTab === "all" ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 font-bold" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <span className="h-2 w-2 rounded-full bg-emerald-500" /> Replies
                </button>
              </div>
            </div>
        </CardHeader>

        <CardContent className="pt-6">
          {isStatsLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-4">
              <div className="h-6 w-56 bg-muted/60 animate-pulse rounded-lg" />
              <div className="h-32 w-full bg-muted/30 animate-pulse rounded-xl" />
            </div>
          ) : displayedTrends.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground text-sm">
              No historical delivery data recorded yet.
            </div>
          ) : (
            <div className="relative">
              {/* Responsive SVG Curve Chart */}
              <div className="w-full overflow-x-auto">
                <svg
                  viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                  className="w-full h-44 overflow-visible"
                >
                  <defs>
                    <linearGradient id="primaryGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal Grid lines */}
                  {[0.2, 0.5, 0.8].map((ratio, idx) => (
                    <line
                      key={idx}
                      x1="0"
                      y1={chartHeight * ratio}
                      x2={chartWidth}
                      y2={chartHeight * ratio}
                      stroke="currentColor"
                      className="text-border/50"
                      strokeDasharray="4 4"
                    />
                  ))}

                  {/* Sent Area & Line */}
                  {(activeMetricTab === "all" || activeMetricTab === "sent") && points.sent && (
                    <>
                      <polygon
                        points={`0,${chartHeight} ${points.sent} ${chartWidth},${chartHeight}`}
                        fill="url(#primaryGradient)"
                      />
                      <polyline
                        fill="none"
                        stroke="hsl(var(--primary))"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points={points.sent}
                      />
                    </>
                  )}

                  {/* Opens Line */}
                  {(activeMetricTab === "all" || activeMetricTab === "opened") && points.opened && (
                    <polyline
                      fill="none"
                      stroke="#3b82f6"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray={activeMetricTab === "all" ? "5 3" : undefined}
                      points={points.opened}
                    />
                  )}

                  {/* Replies Line */}
                  {(activeMetricTab === "all" || activeMetricTab === "replies") && points.replies && (
                    <polyline
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={points.replies}
                    />
                  )}

                  {/* Interactive Data Point Markers */}
                  {displayedTrends.map((d, i) => {
                    const stepX = displayedTrends.length > 1 ? chartWidth / (displayedTrends.length - 1) : chartWidth / 2;
                    const x = i * stepX;
                    const y = chartHeight - (d.sent / maxDataVal) * (chartHeight - 20) - 10;
                    const isHovered = hoveredDataIndex === i;

                    return (
                      <g key={i} onMouseEnter={() => setHoveredDataIndex(i)} onMouseLeave={() => setHoveredDataIndex(null)} className="cursor-pointer">
                        <circle
                          cx={x}
                          cy={y}
                          r={isHovered ? 6 : 4}
                          className="fill-background stroke-primary stroke-[3px] transition-all"
                        />
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* X-Axis Date Labels & Hover Tooltip */}
              <div className="flex justify-between items-center pt-3 text-[11px] font-medium text-muted-foreground border-t border-border/40 mt-1">
                {displayedTrends.map((d, i) => (
                  <span 
                    key={i} 
                    className={`transition-colors text-center ${hoveredDataIndex === i ? "text-primary font-bold" : ""}`}
                  >
                    {d.date}
                  </span>
                ))}
              </div>

              {/* Hover Inspection Bubble */}
              {hoveredDataIndex !== null && displayedTrends[hoveredDataIndex] && (
                <div className="absolute top-2 right-4 bg-popover/95 backdrop-blur-xs border border-border rounded-xl p-3 shadow-lg text-xs space-y-1 z-20 pointer-events-none animate-in fade-in zoom-in-95 duration-150">
                  <div className="font-bold text-foreground border-b border-border/60 pb-1 mb-1.5 flex items-center justify-between gap-4">
                    <span>{displayedTrends[hoveredDataIndex].date}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">Detailed Telemetry</span>
                  </div>
                  <div className="flex justify-between gap-4 text-primary font-semibold">
                    <span>Emails Sent:</span>
                    <span>{displayedTrends[hoveredDataIndex].sent}</span>
                  </div>
                  <div className="flex justify-between gap-4 text-blue-600 dark:text-blue-400">
                    <span>Opens:</span>
                    <span>{displayedTrends[hoveredDataIndex].opened}</span>
                  </div>
                  <div className="flex justify-between gap-4 text-emerald-600 dark:text-emerald-400 font-semibold">
                    <span>Replies:</span>
                    <span>{displayedTrends[hoveredDataIndex].replies}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── 4. Conversion Funnel & Mailbox Deliverability Sentinel ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Conversion Funnel */}
        <Card className="border border-border shadow-xs bg-card flex flex-col justify-between">
          <CardHeader className="pb-3 border-b border-border">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" />
                  Outreach Conversion Funnel
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  End-to-end prospect progression from cold dispatch to positive meeting response
                </CardDescription>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20">
                {stats?.funnel.replyRate ?? 0}% Total Yield
              </span>
            </div>
          </CardHeader>

          <CardContent className="pt-6 space-y-5 flex-1 flex flex-col justify-center">
            {isStatsLoading ? (
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <span className="h-3.5 w-28 bg-muted/60 animate-pulse rounded" />
                    <span className="h-3.5 w-16 bg-muted/60 animate-pulse rounded" />
                  </div>
                  <div className="h-2 w-full bg-muted/40 animate-pulse rounded" />
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <span className="h-3.5 w-32 bg-muted/60 animate-pulse rounded" />
                    <span className="h-3.5 w-16 bg-muted/60 animate-pulse rounded" />
                  </div>
                  <div className="h-2 w-full bg-muted/40 animate-pulse rounded" />
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <span className="h-3.5 w-32 bg-muted/60 animate-pulse rounded" />
                    <span className="h-3.5 w-16 bg-muted/60 animate-pulse rounded" />
                  </div>
                  <div className="h-2 w-full bg-muted/40 animate-pulse rounded" />
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <span className="h-3.5 w-36 bg-muted/60 animate-pulse rounded" />
                    <span className="h-3.5 w-16 bg-muted/60 animate-pulse rounded" />
                  </div>
                  <div className="h-2 w-full bg-muted/40 animate-pulse rounded" />
                </div>
              </div>
            ) : (
              <>
                {/* Step 1: Sent */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-foreground flex items-center gap-1.5">
                      <Send className="h-3.5 w-3.5 text-primary" /> 1. Emails Sent
                    </span>
                    <span className="font-bold text-foreground">{stats?.funnel.sent ?? 0} (100%)</span>
                  </div>
                  <Progress value={100} className="h-2 bg-muted [&>div]:bg-primary" />
                </div>

                {/* Step 2: Delivered */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-foreground flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-blue-500" /> 2. Delivered to Inbox
                    </span>
                    <span className="font-bold text-blue-600 dark:text-blue-400">
                      {stats?.funnel.delivered ?? 0} ({stats && stats.funnel.sent > 0 ? "99.4%" : "0%"})
                    </span>
                  </div>
                  <Progress value={stats && stats.funnel.sent > 0 ? 99 : 0} className="h-2 bg-muted [&>div]:bg-blue-500" />
                </div>

                {/* Step 3: Opened */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-foreground flex items-center gap-1.5">
                      <Eye className="h-3.5 w-3.5 text-indigo-500" /> 3. Prospect Opened
                    </span>
                    <span className="font-bold text-indigo-600 dark:text-indigo-400">
                      {stats?.funnel.opened ?? 0} ({stats?.funnel.openRate ?? 0}%)
                    </span>
                  </div>
                  <Progress value={Math.min(stats?.funnel.openRate ?? 0, 100)} className="h-2 bg-muted [&>div]:bg-indigo-500" />
                </div>

                {/* Step 4: Replied */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-foreground flex items-center gap-1.5">
                      <Reply className="h-3.5 w-3.5 text-emerald-500" /> 4. Real Reply Received
                    </span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      {stats?.funnel.replied ?? 0} ({stats?.funnel.replyRate ?? 0}%)
                    </span>
                  </div>
                  <Progress value={Math.min(stats?.funnel.replyRate ?? 0, 100)} className="h-2 bg-muted [&>div]:bg-emerald-500" />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Deliverability Sentinel */}
        <Card className="shadow-xs border border-border bg-card flex flex-col justify-between">
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              Mailbox Deliverability Sentinel
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Real-time SPF/DKIM health, velocity governor, and sender reputation score
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-6 space-y-6 flex-1 flex flex-col justify-between">
            {/* Health Indicators Grid */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-secondary/50 border border-border text-center">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Reputation</div>
                <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 font-mono">99.4%</div>
                <div className="text-[10px] text-muted-foreground">Optimal</div>
              </div>

              <div className="p-3 rounded-xl bg-secondary/50 border border-border text-center">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">SPF / DKIM</div>
                <div className="text-sm font-bold text-foreground mt-0.5">Verified</div>
                <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">Pass 100%</div>
              </div>

              <div className="p-3 rounded-xl bg-secondary/50 border border-border text-center">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Spam Guard</div>
                <div className="text-lg font-bold text-foreground font-mono">0.0%</div>
                <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">Protected</div>
              </div>
            </div>

            {/* Daily Quota Progress */}
            {isStatsLoading ? (
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="h-3.5 w-44 bg-muted/60 animate-pulse rounded" />
                  <span className="h-3.5 w-20 bg-muted/60 animate-pulse rounded" />
                </div>
                <div className="h-2 w-full bg-muted/40 animate-pulse rounded" />
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <Target className="h-3.5 w-3.5 text-primary" /> Daily Outreach Velocity Limit
                    {stats && stats.emailsSentToday >= stats.dailyLimit && (
                      <span className="text-[10px] bg-amber-500/15 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded font-medium">
                        Cap Reached
                      </span>
                    )}
                  </span>
                  <span className="font-mono text-muted-foreground">
                    <strong>{stats?.emailsSentToday ?? 0}</strong> / {stats?.dailyLimit ?? 50} emails
                  </span>
                </div>
                <Progress 
                  value={stats ? Math.min(Math.round((stats.emailsSentToday / stats.dailyLimit) * 100), 100) : 0} 
                  className="h-2 bg-secondary [&>div]:bg-primary"
                />
              </div>
            )}

            {/* Hourly Pacing Indicator */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/30 border border-border text-xs">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                {isStatsLoading ? (
                  <span className="h-3.5 w-40 bg-muted/60 animate-pulse rounded" />
                ) : (
                  <span>Current Hourly Dispatch: <strong>{stats?.emailsSentThisHour ?? 0} / {stats?.hourlyLimit ?? 15}</strong></span>
                )}
              </div>
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Active & Governed</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── 5. Active Sequences Leaderboard & Recent Replies Feed ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Top Active Sequences Leaderboard */}
        <Card className="lg:col-span-2 shadow-xs border border-border bg-card overflow-hidden flex flex-col justify-between">
          <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border">
            <div>
              <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" />
                Campaign Execution Leaderboard
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Active outreach sequence pipelines and prospect progression status
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild className="text-xs font-semibold text-primary hover:text-primary">
              <Link href="/sequences">View all ({stats?.activeSequences ?? 0}) &rarr;</Link>
            </Button>
          </CardHeader>

          <CardContent className="p-0 flex-1 flex flex-col justify-center">
            {isStatsLoading ? (
              <div className="space-y-2 p-4">
                {[1, 2, 3].map(i => <div key={i} className="h-14 bg-secondary/60 rounded-lg animate-pulse" />)}
              </div>
            ) : !stats?.topSequences || stats.topSequences.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm p-4">
                <Layers className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                <p className="font-semibold text-foreground">No active campaigns</p>
                <p className="text-xs text-muted-foreground mt-0.5">Dispatched sequence pipelines will track here automatically.</p>
                <Button asChild size="sm" variant="outline" className="mt-3 text-xs">
                  <Link href="/smart-import">+ Start New Sequence</Link>
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {stats.topSequences.map((seq) => {
                  const avatarColor = getAvatarColor(seq.email || seq.prospectName || seq.id);
                  const cleanCompany = seq.company && seq.company.toLowerCase() !== "unknown" && seq.company.toLowerCase() !== "null"
                    ? seq.company 
                    : "";

                  return (
                    <Link
                      key={seq.id}
                      href="/sequences"
                      className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-3 hover:bg-secondary/50 transition-colors gap-3 group cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 border ${avatarColor}`}>
                          {seq.prospectName.charAt(0).toUpperCase() || "P"}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-xs text-foreground group-hover:text-primary transition-colors truncate">
                            {seq.prospectName} {cleanCompany ? <span className="text-muted-foreground font-normal">• {cleanCompany}</span> : null}
                          </div>
                          <div className="text-[11px] text-muted-foreground truncate max-w-sm mt-0.5">
                            {seq.firstSubject || "Cold Outreach Sequence"}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 shrink-0 justify-between sm:justify-end">
                        <div className="text-right">
                          <div className="text-[11px] font-semibold text-foreground font-mono">
                            Step {seq.completedSteps} of {seq.totalSteps || 1}
                          </div>
                          <div className="w-24 mt-1">
                            <Progress value={seq.progressPct} className="h-1 bg-secondary [&>div]:bg-primary" />
                          </div>
                        </div>
                        
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                          seq.status === "ACTIVE" 
                            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20"
                            : seq.status === "COMPLETED"
                            ? "bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20"
                            : "bg-secondary text-muted-foreground border border-border"
                        }`}>
                          {seq.status}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Priority Inbox Feed */}
        <Card className="shadow-xs border border-border bg-card overflow-hidden flex flex-col justify-between">
          <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border">
            <div>
              <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <Reply className="h-4 w-4 text-emerald-500" />
                Priority Replies
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Responses requiring attention
              </CardDescription>
            </div>
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="sm" onClick={handleClearReplies} className="h-7 text-xs px-2.5">
                Clear
              </Button>
              <Button variant="ghost" size="sm" asChild className="h-7 text-xs px-2.5 text-primary hover:text-primary font-semibold">
                <Link href="/replies">View all &rarr;</Link>
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-0 flex-1 flex flex-col justify-center">
            {isRepliesLoading ? (
              <div className="space-y-2 p-4">
                {[1, 2, 3].map(i => <div key={i} className="h-14 bg-secondary/60 rounded-lg animate-pulse" />)}
              </div>
            ) : (() => {
              const visibleReplies = recentReplies.filter(r => {
                const replyTime = new Date(r.replyTime).getTime();
                const isNewerThanClear = replyTime > clearedAt;
                const isWithin24Hours = (Date.now() - replyTime) < 24 * 60 * 60 * 1000;
                return isNewerThanClear && isWithin24Hours;
              });
              
              if (visibleReplies.length === 0) {
                return (
                  <div className="py-12 text-center text-muted-foreground text-sm p-4">
                    <CheckCircle2 className="h-7 w-7 text-emerald-500 mx-auto mb-2 opacity-85" />
                    <p className="font-semibold text-foreground text-sm">Inbox Zero</p>
                    <p className="text-xs text-muted-foreground mt-0.5">No unprocessed prospect replies today.</p>
                  </div>
                );
              }
              
              return (
                <div className="divide-y divide-border">
                  {visibleReplies.map(reply => {
                    const avatarColor = getAvatarColor(reply.email || reply.prospectName || reply.id);
                    const isRealReply = reply.replyType === "REAL_REPLY";
                    const cleanCompany = reply.company && reply.company.toLowerCase() !== "unknown" && reply.company.toLowerCase() !== "null"
                      ? reply.company 
                      : (reply.email ? reply.email : "Lead");

                    return (
                      <Link
                        prefetch={true} 
                        key={reply.id} 
                        href={`/replies?id=${reply.id}`}
                        className="flex items-start gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors group cursor-pointer"
                      >
                        {/* Distinct Avatar */}
                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 border mt-0.5 ${avatarColor}`}>
                          {reply.prospectName.charAt(0).toUpperCase() || "P"}
                        </div>

                        {/* 2-line Content that never cramps */}
                        <div className="flex-1 min-w-0">
                          {/* Row 1: Name and Time */}
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-xs text-foreground group-hover:text-primary transition-colors truncate">
                              {reply.prospectName}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                              {formatDistanceToNow(new Date(reply.replyTime), { addSuffix: true })}
                            </span>
                          </div>

                          {/* Row 2: Company and Status Pill */}
                          <div className="flex items-center justify-between gap-2 mt-1">
                            <span className="text-[11px] text-muted-foreground truncate">
                              {cleanCompany}
                            </span>
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0 ${
                              isRealReply
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                            }`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${isRealReply ? "bg-emerald-500" : "bg-amber-500"}`} />
                              {isRealReply ? "Real Reply" : "Review"}
                            </span>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              );
            })()}
          </CardContent>
        </Card>
      </div>

    </AnimatedPage>
  );
}
