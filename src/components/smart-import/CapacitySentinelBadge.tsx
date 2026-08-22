"use client";

import React from "react";
import { ShieldCheck, Clock, Zap, PauseCircle, AlertTriangle, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { evaluateCapacityState } from "@/lib/capacity/forecast";

interface CapacitySentinelBadgeProps {
  step: {
    id: string;
    step_number: number;
    status: string;
    scheduled_at_utc: string | Date;
  };
  sentToday: number;
  dailyLimit: number;
  sentThisHour?: number;
  hourlyLimit?: number;
  isCampaignActive?: boolean;
  userTimezone?: string;
  onOpenDiagnostic?: () => void;
}

export function CapacitySentinelBadge({
  step,
  sentToday,
  dailyLimit,
  sentThisHour = 0,
  hourlyLimit = 15,
  isCampaignActive = true,
  userTimezone = "UTC",
  onOpenDiagnostic,
}: CapacitySentinelBadgeProps) {
  const scheduledTime = new Date(step.scheduled_at_utc).getTime();
  const now = Date.now();
  const isPastDue = scheduledTime <= now;

  const capacity = evaluateCapacityState(
    sentToday,
    dailyLimit,
    sentThisHour,
    hourlyLimit,
    1,
    userTimezone
  );

  // If already SENT, FAILED, or STOPPED, let standard badges render
  if (step.status === "SENT" || step.status === "FAILED" || step.status === "STOPPED" || step.status === "CANCELLED") {
    return null;
  }

  // Case 1: Campaign is paused
  if (!isCampaignActive || step.status === "PAUSED") {
    return (
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              onClick={onOpenDiagnostic}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 cursor-pointer hover:bg-amber-500/20 transition-all"
            >
              <PauseCircle className="h-3.5 w-3.5" />
              <span>Paused by User</span>
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs text-xs">
            <p className="font-semibold">Campaign Paused</p>
            <p className="text-muted-foreground mt-0.5">Dispatches are halted while the campaign is paused. Click to inspect.</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Case 2: Daily Capacity Limit Reached (e.g. 4/4)
  if (capacity.isDailyCapReached && (step.status === "PENDING" || step.status === "PROCESSING")) {
    return (
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              onClick={onOpenDiagnostic}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30 cursor-pointer hover:bg-amber-500/20 transition-all shadow-2xs"
            >
              <ShieldCheck className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
              <span>Queued: Daily Cap Reached ({sentToday}/{dailyLimit})</span>
              <Info className="h-3 w-3 opacity-60 ml-0.5" />
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs text-xs space-y-1 p-2.5">
            <div className="flex items-center gap-1.5 font-bold text-amber-600 dark:text-amber-400">
              <ShieldCheck className="h-4 w-4" />
              <span>Deliverability Sentinel Protection Active</span>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              Safely held to protect your Gmail account reputation. Next sending window opens automatically tomorrow at midnight ({userTimezone.split("/").pop() || "UTC"}).
            </p>
            <p className="text-primary font-medium pt-1 text-[11px]">Click to view 1-click diagnostic & capacity scaling options &rarr;</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Case 3: Hourly Pacing Governor Active (e.g. 15/15)
  if (capacity.isHourlyPacingActive && (step.status === "PENDING" || step.status === "PROCESSING")) {
    return (
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              onClick={onOpenDiagnostic}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/30 cursor-pointer hover:bg-blue-500/20 transition-all"
            >
              <Clock className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              <span>Paced: Hourly Cap ({sentThisHour}/{hourlyLimit})</span>
              <Info className="h-3 w-3 opacity-60 ml-0.5" />
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs text-xs space-y-1">
            <p className="font-semibold text-blue-600 dark:text-blue-400">Hourly Human Pacing Active</p>
            <p className="text-muted-foreground">Governed at {hourlyLimit} emails/hour to mimic natural human behavior. Next batch dispatches at the top of the hour.</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Case 4: Capacity Available & Step is Due (Ready to Dispatch)
  if (isPastDue && step.status === "PENDING") {
    return (
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              onClick={onOpenDiagnostic}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 cursor-pointer hover:bg-emerald-500/20 transition-all animate-pulse"
            >
              <Zap className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Ready to Dispatch</span>
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs text-xs">
            <p className="font-semibold text-emerald-600 dark:text-emerald-400">Dispatch Window Open</p>
            <p className="text-muted-foreground">Capacity headroom is open ({capacity.dailyHeadroom} sends remaining today). Step will dispatch in the active cycle.</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Case 5: Normal future scheduled step
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-secondary text-muted-foreground border border-border">
      <Clock className="h-3.5 w-3.5 text-primary" />
      <span>Scheduled</span>
    </span>
  );
}
