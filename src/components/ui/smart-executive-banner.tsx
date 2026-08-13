import React, { useState, useEffect } from "react";
import { X, MessageSquare, Target, CheckCircle2, AlertCircle, ShieldAlert, Sparkles } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export interface BannerState {
  priority: number;
  icon: React.ReactNode;
  title: string;
  message: string;
  actionLabel?: string;
  actionTarget?: string;
}

/**
 * Custom hook separating the banner's business logic from its UI.
 * Computes the highest priority message based on existing dashboard data.
 */
export function useSmartExecutiveBannerLogic(stats: any, recentReplies: any[]): BannerState {
  const [name, setName] = useState("Team");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedName = localStorage.getItem("outreachiq_display_name");
      if (storedName) {
        setName(storedName);
      }
    }
  }, []);

  // Fallback default
  let state: BannerState = {
    priority: 6,
    icon: <Sparkles className="h-5 w-5 text-emerald-600" />,
    title: `Good Morning, ${name}`,
    message: "Everything is running smoothly.",
  };

  if (!stats) return state; // Loading or no data

  // Priority 1: New Replies (pending reviews)
  if (stats.pendingReviews > 0) {
    state = {
      priority: 1,
      icon: <MessageSquare className="h-5 w-5 text-blue-600" />,
      title: `Good Morning, ${name}`,
      message: `${stats.pendingReviews} new replies are waiting for your review.`,
      actionLabel: "View Replies",
      actionTarget: "/replies",
    };
  }
  // Priority 2: Potential Customers (INTERESTED replies in recent)
  else if (recentReplies && recentReplies.some((r: any) => r.replyType === 'INTERESTED')) {
    const interestedCount = recentReplies.filter((r: any) => r.replyType === 'INTERESTED').length;
    state = {
      priority: 2,
      icon: <Target className="h-5 w-5 text-indigo-600" />,
      title: `Good Morning, ${name}`,
      message: `${interestedCount} potential customer${interestedCount > 1 ? 's' : ''} need your attention.`,
      actionLabel: "View Prospects",
      actionTarget: "/prospects",
    };
  }
  // Priority 3: Campaign Finished (Stopped Sequences)
  else if (stats.stoppedSequences > 0) {
    state = {
      priority: 3,
      icon: <CheckCircle2 className="h-5 w-5 text-emerald-600" />,
      title: `Good Morning, ${name}`,
      message: `${stats.stoppedSequences} sequence${stats.stoppedSequences > 1 ? 's' : ''} finished successfully.`,
      actionLabel: "View Sequences",
      actionTarget: "/sequences",
    };
  }
  // Priority 4: Campaign Needs Attention (Failed Steps)
  else if (stats.failedSteps > 0) {
    state = {
      priority: 4,
      icon: <AlertCircle className="h-5 w-5 text-amber-600" />,
      title: `Good Morning, ${name}`,
      message: `${stats.failedSteps} step${stats.failedSteps > 1 ? 's' : ''} failed to send and need attention.`,
      actionLabel: "View Errors",
      actionTarget: "/system-health",
    };
  }
  // Priority 5: Warmup Limit Reached (Scheduler paused/limit)
  else if (stats.schedulerStatus === "PAUSED" || stats.schedulerStatus === "LIMIT_REACHED") {
    state = {
      priority: 5,
      icon: <ShieldAlert className="h-5 w-5 text-orange-600" />,
      title: `Good Morning, ${name}`,
      message: "Warmup limit reached. Sending resumes tomorrow.",
    };
  }

  return state;
}

export function SmartExecutiveBanner({ stats, recentReplies }: { stats: any, recentReplies: any[] }) {
  const bannerState = useSmartExecutiveBannerLogic(stats, recentReplies);
  const [isDismissed, setIsDismissed] = useState(true); // Default true to prevent hydration mismatch flash
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Client-side hydration
    const today = new Date().toISOString().split('T')[0];
    const lastDismissedDate = localStorage.getItem("exec_banner_dismissed_date");
    const lastDismissedPriority = localStorage.getItem("exec_banner_dismissed_priority");

    // Show if it's a new day, OR if we have a HIGHER (lower number) priority message than what was dismissed today
    if (lastDismissedDate !== today || (lastDismissedPriority && bannerState.priority < parseInt(lastDismissedPriority))) {
      setIsDismissed(false);
      // Slight delay for subtle fade-in effect
      setTimeout(() => setIsVisible(true), 100);
    }
  }, [bannerState.priority]);

  const handleDismiss = () => {
    setIsVisible(false);
    setTimeout(() => {
      setIsDismissed(true);
      const today = new Date().toISOString().split('T')[0];
      localStorage.setItem("exec_banner_dismissed_date", today);
      localStorage.setItem("exec_banner_dismissed_priority", bannerState.priority.toString());
    }, 300); // Wait for fade-out animation
  };

  if (isDismissed) return null;

  // Compute specific styling based on priority
  const borderColors: Record<number, string> = {
    1: 'border-l-blue-500',
    2: 'border-l-indigo-500',
    3: 'border-l-emerald-500',
    4: 'border-l-amber-500',
    5: 'border-l-orange-500',
    6: 'border-l-slate-300'
  };

  const bgColors: Record<number, string> = {
    1: 'bg-blue-50/50',
    2: 'bg-indigo-50/50',
    3: 'bg-emerald-50/50',
    4: 'bg-amber-50/50',
    5: 'bg-orange-50/50',
    6: 'bg-slate-50/50'
  };

  const defaultPriorityBorder = borderColors[bannerState.priority] || 'border-l-slate-300';
  const defaultIconBg = bgColors[bannerState.priority] || 'bg-slate-50';

  // ── Global Theme Override (from Admin Panel) ──────────────────────────────
  const theme = stats?.bannerTheme || "DEFAULT";
  let themeContainerClass = `bg-card border-y border-r border-l-4 ${defaultPriorityBorder} border-y-border border-r-border shadow-sm rounded-xl`;
  let themeIconClass = defaultIconBg;

  if (theme === "GREEN") {
    themeContainerClass = "bg-gradient-to-r from-emerald-50/80 to-card border border-emerald-100 shadow-sm rounded-xl";
    themeIconClass = "bg-emerald-100/50 text-emerald-600";
  } else if (theme === "RED") {
    themeContainerClass = "bg-gradient-to-r from-rose-50/80 to-card border border-rose-100 shadow-sm rounded-xl";
    themeIconClass = "bg-rose-100/50 text-rose-600";
  } else if (theme === "BLUE") {
    themeContainerClass = "bg-gradient-to-r from-blue-50/80 to-card border border-blue-100 shadow-sm rounded-xl";
    themeIconClass = "bg-blue-100/50 text-blue-600";
  } else if (theme === "ORANGE") {
    themeContainerClass = "bg-gradient-to-r from-orange-50/80 to-card border border-orange-100 shadow-sm rounded-xl";
    themeIconClass = "bg-orange-100/50 text-orange-600";
  } else if (theme === "PURPLE") {
    themeContainerClass = "bg-gradient-to-r from-purple-50/80 to-card border border-purple-100 shadow-sm rounded-xl";
    themeIconClass = "bg-purple-100/50 text-purple-600";
  }

  return (
    <div 
      className={`relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 mb-8 transition-all duration-500 ease-in-out ${themeContainerClass} ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"
      }`}
    >
      <div className="flex items-center gap-4">
        <div className={`flex items-center justify-center p-3 rounded-full ${themeIconClass}`}>
          {bannerState.icon}
        </div>
        <div className="flex flex-col">
          <h3 className="text-base font-semibold text-foreground tracking-tight">{bannerState.title}</h3>
          <p className="text-sm text-muted-foreground mt-0.5">{bannerState.message}</p>
        </div>
      </div>

      <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
        {bannerState.actionLabel && bannerState.actionTarget && (
          <Button size="sm" className="h-9 px-4 text-xs font-medium shadow-sm" asChild>
            <Link prefetch={true} href={bannerState.actionTarget}>{bannerState.actionLabel}</Link>
          </Button>
        )}
        <button 
          onClick={handleDismiss}
          className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-full transition-colors ml-2"
          aria-label="Dismiss banner"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
