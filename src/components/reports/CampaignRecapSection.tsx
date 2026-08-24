import React from "react";
import { CheckCircle2, ClipboardList } from "lucide-react";

interface CampaignRecapSectionProps {
  summaryPoints: string[];
}

export function CampaignRecapSection({ summaryPoints }: CampaignRecapSectionProps) {
  return (
    <div className="bg-card border border-border/80 rounded-2xl p-6 md:p-8 shadow-xs space-y-4 print-avoid-break">
      <div className="flex items-center gap-2.5 pb-3 border-b border-border/60">
        <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
          <ClipboardList className="w-4 h-4" />
        </div>
        <h2 className="text-base md:text-lg font-bold text-foreground tracking-tight">
          Campaign Performance Summary
        </h2>
      </div>

      <div className="space-y-3 pt-1">
        {summaryPoints.map((point, idx) => (
          <div key={idx} className="flex items-start gap-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
            <p className="text-xs md:text-sm text-foreground/90 leading-relaxed font-medium">
              {point}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
