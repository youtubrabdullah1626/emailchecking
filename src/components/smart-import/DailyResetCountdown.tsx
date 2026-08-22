"use client";

import React, { useState, useEffect, useMemo } from "react";
import { ShieldCheck, Clock, Zap, ArrowUpRight } from "lucide-react";
import { getNextDailyResetWindow, getNextHourlyResetWindow } from "@/lib/capacity/forecast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface DailyResetCountdownProps {
  sentToday: number;
  dailyLimit: number;
  sentThisHour?: number;
  hourlyLimit?: number;
  userTimezone?: string;
  onOpenScaleModal?: () => void;
}

export function DailyResetCountdown({
  sentToday,
  dailyLimit,
  sentThisHour = 0,
  hourlyLimit = 15,
  userTimezone = "UTC",
  onOpenScaleModal,
}: DailyResetCountdownProps) {
  const [timeLeft, setTimeLeft] = useState<{ hours: number; minutes: number; seconds: number } | null>(null);

  const isDailyCapReached = sentToday >= dailyLimit && dailyLimit > 0;
  const isHourlyPacingActive = !isDailyCapReached && sentThisHour >= hourlyLimit && hourlyLimit > 0;

  const targetResetDate = useMemo(() => {
    if (isDailyCapReached) {
      return getNextDailyResetWindow(userTimezone);
    }
    if (isHourlyPacingActive) {
      return getNextHourlyResetWindow();
    }
    return null;
  }, [isDailyCapReached, isHourlyPacingActive, userTimezone]);

  useEffect(() => {
    if (!targetResetDate) {
      setTimeLeft(null);
      return;
    }

    const updateCountdown = () => {
      const now = Date.now();
      const diffMs = Math.max(0, targetResetDate.getTime() - now);

      const totalSeconds = Math.floor(diffMs / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      setTimeLeft({ hours, minutes, seconds });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [targetResetDate]);

  if (!isDailyCapReached && !isHourlyPacingActive) {
    const headroom = Math.max(0, dailyLimit - sentToday);
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 text-xs font-semibold shadow-2xs">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
        <span>Daily Headroom: <strong>{headroom}</strong> / {dailyLimit} sends remaining</span>
      </div>
    );
  }

  const formatDigits = (n: number) => String(n).padStart(2, "0");

  if (isDailyCapReached && timeLeft) {
    return (
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              onClick={onOpenScaleModal}
              className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-xs font-semibold cursor-pointer hover:bg-amber-500/20 transition-all shadow-2xs"
            >
              <ShieldCheck className="h-4 w-4 text-amber-600 dark:text-amber-400 animate-pulse" />
              <span>
                Daily Protection Active ({sentToday}/{dailyLimit}) &bull; Next Window:{" "}
                <span className="font-mono font-bold tracking-tight">
                  {formatDigits(timeLeft.hours)}h : {formatDigits(timeLeft.minutes)}m : {formatDigits(timeLeft.seconds)}s
                </span>
              </span>
              <span className="text-[10px] bg-amber-500/20 px-1.5 py-0.5 rounded text-amber-800 dark:text-amber-200 uppercase font-mono">
                {userTimezone.split("/").pop() || "UTC"}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs text-xs space-y-1 p-3">
            <p className="font-bold text-amber-600 dark:text-amber-400">Account Safety Sentinel Active</p>
            <p className="text-muted-foreground">
              To keep your Gmail inbox 100% healthy, sending paused after reaching your daily cap of {dailyLimit} emails.
              Dispatches automatically resume at midnight.
            </p>
            <div className="pt-1 text-primary font-semibold flex items-center gap-1">
              Want to send more today? Connect another inbox &rarr;
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (isHourlyPacingActive && timeLeft) {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20 text-xs font-semibold shadow-2xs">
        <Clock className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
        <span>
          Hourly Pacing ({sentThisHour}/{hourlyLimit}) &bull; Next Batch in:{" "}
          <span className="font-mono font-bold">
            {formatDigits(timeLeft.minutes)}m : {formatDigits(timeLeft.seconds)}s
          </span>
        </span>
      </div>
    );
  }

  return null;
}
