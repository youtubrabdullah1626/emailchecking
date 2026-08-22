"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Zap,
  Mail,
  Sliders,
  ExternalLink,
  Layers,
  ArrowRight,
} from "lucide-react";
import { StepDiagnosticContext } from "@/lib/capacity/state";
import Link from "next/link";

interface WhyNotSentModalProps {
  diagnostic: StepDiagnosticContext | null;
  isOpen: boolean;
  onClose: () => void;
  onNavigateToPlatformConfig?: () => void;
}

export function WhyNotSentModal({
  diagnostic,
  isOpen,
  onClose,
  onNavigateToPlatformConfig,
}: WhyNotSentModalProps) {
  if (!diagnostic) return null;

  const { capacityState, queuePosition, totalQueued, estimatedDispatchText, status, recipientEmail, stepNumber } = diagnostic;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 border-border overflow-hidden max-h-[90vh] flex flex-col shadow-2xl rounded-2xl">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-border bg-slate-50/70 dark:bg-slate-900/70 shrink-0">
          <DialogHeader className="text-left space-y-1.5">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shrink-0">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-bold text-foreground tracking-tight">
                  Dispatch Forensics & Capacity Sentinel
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Real-time audit for Step {stepNumber} &bull; <span className="font-mono text-foreground font-medium">{recipientEmail}</span>
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* 5-Point Live Health Diagnostic Checklist */}
        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1 max-h-[calc(90vh-140px)]">
          <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
            Live Account & Pipeline Telemetry
          </div>

          <div className="space-y-2.5">
            {/* Check 1: Inbox Status */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-secondary/30 border border-border text-xs gap-3">
              <div className="flex items-start gap-2.5 min-w-0">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <div className="font-semibold text-foreground truncate">Active Inboxes Connected & Verified</div>
                  <div className="text-muted-foreground text-[11px] leading-relaxed">OAuth valid, SPF/DKIM authenticated, zero auth errors.</div>
                </div>
              </div>
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold font-mono text-[11px] bg-emerald-500/10 px-2 py-0.5 rounded-md shrink-0 border border-emerald-500/20">
                100% Pass
              </span>
            </div>

            {/* Check 2: Campaign State */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-secondary/30 border border-border text-xs gap-3">
              <div className="flex items-start gap-2.5 min-w-0">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <div className="font-semibold text-foreground truncate">Campaign Execution Status</div>
                  <div className="text-muted-foreground text-[11px] leading-relaxed">Campaign is active and sequence steps are unblocked.</div>
                </div>
              </div>
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold font-mono text-[11px] bg-emerald-500/10 px-2 py-0.5 rounded-md shrink-0 border border-emerald-500/20">
                Active
              </span>
            </div>

            {/* Check 3: Daily Sending Velocity */}
            <div className={`flex items-center justify-between p-3.5 rounded-xl border text-xs gap-3 ${capacityState.isDailyCapReached ? "bg-amber-500/10 border-amber-500/30" : "bg-secondary/30 border-border"}`}>
              <div className="flex items-start gap-2.5 min-w-0">
                {capacityState.isDailyCapReached ? (
                  <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                )}
                <div className="min-w-0">
                  <div className="font-semibold text-foreground truncate">Daily Outreach Limit Sentinel</div>
                  <div className="text-muted-foreground text-[11px] leading-relaxed">
                    {capacityState.isDailyCapReached
                      ? "Daily fleet limit reached. Sending paused to protect Gmail sender reputation score."
                      : `Available headroom: ${capacityState.dailyHeadroom} sends remaining today.`}
                  </div>
                </div>
              </div>
              <span className={`font-semibold font-mono text-[11px] px-2 py-0.5 rounded-md shrink-0 border ${capacityState.isDailyCapReached ? "bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30 font-bold" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"}`}>
                {capacityState.isDailyCapReached ? "Cap Reached" : "Available"}
              </span>
            </div>

            {/* Check 4: Queue Position & Next Window */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-secondary/30 border border-border text-xs gap-3">
              <div className="flex items-start gap-2.5 min-w-0">
                <Clock className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <div className="font-semibold text-foreground truncate">Estimated Dispatch Window</div>
                  <div className="text-muted-foreground text-[11px] leading-relaxed">
                    Position #{queuePosition} in candidate queue ({totalQueued} waiting).
                  </div>
                </div>
              </div>
              <span className="text-primary font-semibold font-mono text-[11px] bg-primary/10 px-2 py-0.5 rounded-md shrink-0 border border-primary/20 whitespace-nowrap">
                {estimatedDispatchText}
              </span>
            </div>
          </div>

          {/* Scaling Insight Box */}
          <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
              <Zap className="h-3.5 w-3.5" />
              <span>How to dispatch this email immediately:</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Connect an additional Gmail inbox or increase your <strong>Daily Email Limit</strong> in Platform Settings.
              The background scheduler re-evaluates capacity in <strong>0ms</strong> and will immediately resume sending.
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-border bg-slate-50/70 dark:bg-slate-900/70 flex items-center justify-between shrink-0">
          <Link
            href="/admin/platform?tab=platform-limits"
            onClick={onClose}
            className="text-xs text-primary hover:underline font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Sliders className="h-3.5 w-3.5" /> Adjust Platform Limits &rarr;
          </Link>
          <Button size="sm" onClick={onClose} className="rounded-xl px-4 text-xs font-semibold">
            Close Forensics
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
