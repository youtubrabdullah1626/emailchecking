import React from "react";
import { CheckCircle2 } from "lucide-react";

interface CampaignRecapSectionProps {
  summaryPoints: string[];
}

export function CampaignRecapSection({ summaryPoints }: CampaignRecapSectionProps) {
  return (
    <div className="pt-2 space-y-3 print-avoid-break">
      <div className="pb-2 border-b border-slate-200/80 dark:border-slate-800">
        <h2 className="text-sm md:text-base font-bold text-slate-900 dark:text-white tracking-tight">
          Campaign Performance Summary
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Deterministic outbound metrics recorded by Silaer Autonomous Engine
        </p>
      </div>

      <div className="space-y-2 pt-1">
        {summaryPoints.map((point, idx) => (
          <div key={idx} className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <p className="text-xs md:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              {point}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
