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

  return (
    <div className="min-h-screen bg-slate-100/70 dark:bg-slate-950 p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Dynamic Header Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xs relative overflow-hidden transition-all duration-300">
        {/* Ambient Gradient Glow */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-80 h-80 bg-gradient-to-br from-orange-500/10 via-amber-500/5 to-transparent rounded-full blur-2xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5 relative z-10">
          <div className="flex items-start sm:items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-orange-500/20">
              <Activity className="h-6 w-6" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  Email Timeline Inspector
                </h1>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border border-orange-200 dark:border-orange-900/60 bg-orange-50 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300">
                  <Sparkles className="h-2.5 w-2.5" />
                  Live Forensics
                </span>
              </div>
              <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1">
                Real-time tracking of every email lifecycle event, Gmail API delivery speed, and recipient engagement.
              </p>
            </div>
          </div>

          {/* Clean Stream Status Badges */}
          <div className="flex items-center gap-2.5 shrink-0 self-start md:self-center">
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-2xs">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Live Stream Active</span>
            </div>
            <div className="hidden lg:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-500 dark:text-slate-400">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
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
