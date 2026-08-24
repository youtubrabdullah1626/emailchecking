import React from "react";
import { Zap, ArrowRight, ShieldCheck } from "lucide-react";

interface ReportFooterBadgeProps {
  referralUrl: string;
}

export function ReportFooterBadge({ referralUrl }: ReportFooterBadgeProps) {
  return (
    <div className="bg-gradient-to-r from-card via-muted/40 to-card border border-border/80 rounded-2xl p-6 shadow-xs relative overflow-hidden transition-all duration-200 print-avoid-break">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <Zap className="w-3 h-3 fill-current" />
            </div>
            <span className="text-xs md:text-sm font-bold text-foreground tracking-tight">
              Powered by Silaer Enterprise Engine
            </span>
          </div>
          <p className="text-xs text-muted-foreground font-medium">
            Autonomous multi-inbox rotation, JIT follow-ups, and 100% deliverability monitoring.
          </p>
        </div>

        <a
          href={referralUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-xs shrink-0 no-print"
        >
          <span>Explore Silaer for Your Sales Team</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
}
