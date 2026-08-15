import React from "react";
import { TimelineInspector } from "@/components/timeline/TimelineInspector";
import { Activity, ShieldCheck } from "lucide-react";

export const metadata = {
  title: "Email Timeline Inspector | OutreachIQ",
  description: "Live Excel-style delivery forensics and tracking debugger",
};

export default function TimelinePage() {
  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Page Title & Breadcrumb */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-orange-600 dark:text-orange-400 uppercase tracking-wider mb-1">
            <Activity className="h-3.5 w-3.5" />
            <span>Delivery Forensics & Telemetry</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
            Email Timeline Inspector
          </h1>
          <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Real-time spreadsheet view tracking every email lifecycle event, Gmail API latency, and recipient engagement.
          </p>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm text-xs text-slate-600 dark:text-slate-400">
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
          <span>Real-time RFC-822 Telemetry Active</span>
        </div>
      </div>

      {/* Main Inspector Component */}
      <TimelineInspector />
    </div>
  );
}
