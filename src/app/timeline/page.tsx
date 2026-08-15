import React from "react";
import { Metadata } from "next";
import { TimelineInspector } from "@/components/timeline/TimelineInspector";
import { Sparkles, ShieldCheck, Activity } from "lucide-react";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Email Timeline Inspector | Silaer",
  description: "Detailed end-to-end lifecycle inspection and delivery latencies for outreach emails.",
};

export default async function TimelinePage() {
  // Fetch active theme set in Platform Config Admin Panel
  let bannerTheme = "ORANGE";
  try {
    const config = await prisma.platform_configs.findFirst({ where: { key: "BANNER_THEME" } });
    if (config?.value) {
      bannerTheme = String(config.value).toUpperCase();
    }
  } catch (e) {
    console.error("Failed to load BANNER_THEME in /timeline:", e);
  }

  // Dynamic Theme Styling Configuration matching Platform Config
  const themeStyles: Record<string, { container: string; icon: string; badge: string; text: string }> = {
    ORANGE: {
      container: "bg-gradient-to-r from-orange-100/70 via-amber-50/60 to-white dark:from-slate-900 dark:via-slate-900 dark:to-slate-800/80 border-orange-200/80 dark:border-orange-950/40",
      icon: "bg-orange-100 dark:bg-orange-950/70 text-orange-600 dark:text-orange-400 border-orange-200/80 dark:border-orange-800/50",
      badge: "bg-orange-100/80 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 border-orange-200/60 dark:border-orange-800/40",
      text: "text-orange-600 dark:text-orange-400"
    },
    BLUE: {
      container: "bg-gradient-to-r from-blue-100/70 via-sky-50/60 to-white dark:from-slate-900 dark:via-slate-900 dark:to-slate-800/80 border-blue-200/80 dark:border-blue-950/40",
      icon: "bg-blue-100 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 border-blue-200/80 dark:border-blue-800/50",
      badge: "bg-blue-100/80 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200/60 dark:border-blue-800/40",
      text: "text-blue-600 dark:text-blue-400"
    },
    GREEN: {
      container: "bg-gradient-to-r from-emerald-100/70 via-teal-50/60 to-white dark:from-slate-900 dark:via-slate-900 dark:to-slate-800/80 border-emerald-200/80 dark:border-emerald-950/40",
      icon: "bg-emerald-100 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 border-emerald-200/80 dark:border-emerald-800/50",
      badge: "bg-emerald-100/80 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200/60 dark:border-emerald-800/40",
      text: "text-emerald-600 dark:text-emerald-400"
    },
    PURPLE: {
      container: "bg-gradient-to-r from-purple-100/70 via-indigo-50/60 to-white dark:from-slate-900 dark:via-slate-900 dark:to-slate-800/80 border-purple-200/80 dark:border-purple-950/40",
      icon: "bg-purple-100 dark:bg-purple-950/70 text-purple-600 dark:text-purple-400 border-purple-200/80 dark:border-purple-800/50",
      badge: "bg-purple-100/80 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200/60 dark:border-purple-800/40",
      text: "text-purple-600 dark:text-purple-400"
    },
    RED: {
      container: "bg-gradient-to-r from-rose-100/70 via-red-50/60 to-white dark:from-slate-900 dark:via-slate-900 dark:to-slate-800/80 border-rose-200/80 dark:border-rose-950/40",
      icon: "bg-rose-100 dark:bg-rose-950/70 text-rose-600 dark:text-rose-400 border-rose-200/80 dark:border-rose-800/50",
      badge: "bg-rose-100/80 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200/60 dark:border-rose-800/40",
      text: "text-rose-600 dark:text-rose-400"
    },
  };

  const currentTheme = themeStyles[bannerTheme] || themeStyles.ORANGE;

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Dynamic Header Banner — Automatically reacts to Platform Config Admin Panel */}
      <div className={`border rounded-2xl p-5 md:p-6 shadow-xs relative overflow-hidden transition-all duration-300 ${currentTheme.container}`}>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start sm:items-center gap-4">
            {/* Theme-Reactive Icon Circle */}
            <div className={`h-11 w-11 rounded-full flex items-center justify-center shrink-0 border shadow-xs transition-colors ${currentTheme.icon}`}>
              <Activity className="h-5 w-5" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                  Email Timeline Inspector
                </h1>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border transition-colors ${currentTheme.badge}`}>
                  <Sparkles className="h-2.5 w-2.5" />
                  Live Forensics
                </span>
              </div>
              <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 mt-1">
                Real-time tracking of every email lifecycle event, Gmail API delivery speed, and recipient engagement.
              </p>
            </div>
          </div>

          {/* Clean Stream Status Badges */}
          <div className="flex items-center gap-2 shrink-0 self-start md:self-center">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/90 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 shadow-2xs">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Live Stream Active</span>
            </div>
            <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/70 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 text-xs text-slate-500 dark:text-slate-400">
              <ShieldCheck className={`h-3.5 w-3.5 ${currentTheme.text}`} />
              <span>RFC-822 Verified</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Inspector Component */}
      <TimelineInspector />
    </div>
  );
}
