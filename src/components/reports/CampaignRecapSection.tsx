import React from "react";
import { CheckCircle2, FileSpreadsheet, Sparkles } from "lucide-react";

interface CampaignRecapSectionProps {
  summaryPoints: string[];
}

export function CampaignRecapSection({ summaryPoints }: CampaignRecapSectionProps) {
  return (
    <div className="bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-6 md:p-7 shadow-xs space-y-4 print-avoid-break">
      <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20">
            <FileSpreadsheet className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm md:text-base font-bold text-slate-900 dark:text-white tracking-tight">
              Campaign Performance Summary
            </h2>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Deterministic outbound metrics recorded by Silaer Autonomous Engine
            </span>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-200/60 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300">
          <Sparkles className="w-3 h-3 text-emerald-500" />
          <span>Factual Audit</span>
        </div>
      </div>

      <div className="space-y-2.5 pt-1">
        {summaryPoints.map((point, idx) => (
          <div
            key={idx}
            className="flex items-start gap-3 p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800/70 shadow-2xs"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
            <p className="text-xs md:text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
              {point}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
