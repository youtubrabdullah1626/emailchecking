import React from "react";
import { TimelineInspector } from "@/components/timeline/TimelineInspector";
import { Activity, ShieldCheck, Sparkles, Zap, Server } from "lucide-react";

export const metadata = {
  title: "Email Timeline Inspector | OutreachIQ Precision Forensics",
  description: "Live Excel-style delivery forensics and tracking debugger",
};

export default function TimelinePage() {
  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Premium Executive Hero Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white rounded-2xl p-6 md:p-8 shadow-md border border-slate-700/50 relative overflow-hidden">
        {/* Subtle Decorative Ambient Elements */}
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-12 w-48 h-48 bg-orange-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-semibold tracking-wide">
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              <span>PRECISION FORENSICS & TELEMETRY HUB</span>
            </div>
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight text-white flex items-center gap-3">
              <span>Email Timeline Inspector</span>
            </h1>
            <p className="text-xs md:text-sm text-slate-300 leading-relaxed">
              Enterprise-grade diagnostic engine auditing every single email dispatch, Google API response speed, and live prospect engagement with millisecond precision.
            </p>
          </div>

          {/* Real-time Status Badges */}
          <div className="flex flex-wrap lg:flex-col items-start lg:items-end gap-2 shrink-0">
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-slate-200 shadow-xs">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-semibold text-white">Live Telemetry Connected</span>
            </div>
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-800/60 border border-slate-700/60 text-xs text-slate-300">
              <ShieldCheck className="h-4 w-4 text-indigo-400" />
              <span>RFC-822 Audit Authenticated</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Inspector Component */}
      <TimelineInspector />
    </div>
  );
}
