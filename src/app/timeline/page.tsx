import React from "react";
import { TimelineInspector } from "@/components/timeline/TimelineInspector";
import { Sparkles, ShieldCheck, Activity } from "lucide-react";

export const metadata = {
  title: "Email Timeline Inspector | OutreachIQ",
  description: "Live Excel-style delivery forensics and tracking debugger",
};

export default function TimelinePage() {
  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Signature OutreachIQ Warm Banner (Matches App Aesthetic) */}
      <div className="bg-gradient-to-r from-orange-100/70 via-amber-50/60 to-white dark:from-slate-900 dark:via-slate-900 dark:to-slate-800/80 border border-orange-200/80 dark:border-orange-950/40 rounded-2xl p-5 md:p-6 shadow-xs relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start sm:items-center gap-4">
            {/* Signature Icon Circle */}
            <div className="h-11 w-11 rounded-full bg-orange-100 dark:bg-orange-950/70 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0 border border-orange-200/80 dark:border-orange-800/50 shadow-xs">
              <Activity className="h-5 w-5" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                  Email Timeline Inspector
                </h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-100/80 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 text-[10px] font-semibold border border-orange-200/60 dark:border-orange-800/40">
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
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/90 dark:bg-slate-800 border border-orange-200/60 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 shadow-2xs">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Live Stream Active</span>
            </div>
            <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/70 dark:bg-slate-800/60 border border-orange-100 dark:border-slate-700/60 text-xs text-slate-500 dark:text-slate-400">
              <ShieldCheck className="h-3.5 w-3.5 text-orange-500" />
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
