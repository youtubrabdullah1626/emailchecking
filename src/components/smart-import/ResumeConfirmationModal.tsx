"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Clock, Play, Loader2, ShieldCheck, Mail, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface OverdueEmailItem {
  id: string;
  recipientEmail: string;
  stepNumber: number;
  subject?: string;
  scheduledTime: string;
  scheduledDate: string;
  timezone?: string;
}

interface ResumeConfirmationModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  overdueItems: OverdueEmailItem[];
  onConfirmResume: () => void;
  isResuming?: boolean;
}

export function ResumeConfirmationModal({
  isOpen,
  onOpenChange,
  overdueItems,
  onConfirmResume,
  isResuming = false,
}: ResumeConfirmationModalProps) {
  const handleConfirm = () => {
    onConfirmResume();
  };

  const initialCount = overdueItems.length;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!isResuming) onOpenChange(open); }}>
      <DialogContent className="max-w-lg rounded-2xl shadow-2xl border-slate-200 dark:border-slate-800 p-6">
        <DialogHeader className="space-y-3">
          <DialogTitle className="flex items-center gap-2.5 text-slate-900 dark:text-slate-100 text-lg font-bold">
            <div className="h-9 w-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center shrink-0">
              <Play className="h-4 w-4 fill-current" />
            </div>
            <span>Resume Outreach Campaign</span>
            <Badge variant="outline" className="ml-auto bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 font-semibold text-xs py-0.5 px-2.5">
              {initialCount} {initialCount === 1 ? "Email Ready" : "Emails Ready"}
            </Badge>
          </DialogTitle>
          
          <DialogDescription className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Resuming the campaign will dispatch <strong>{initialCount} {initialCount === 1 ? "initial outreach email" : "initial outreach emails"}</strong> that reached their send window while paused.
          </DialogDescription>
        </DialogHeader>

        {/* 10x Smart Clarification Alert */}
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/40 text-blue-900 dark:text-blue-200">
          <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <div className="text-[11px] leading-relaxed space-y-1">
            <p className="font-semibold text-blue-800 dark:text-blue-300">
              Follow-ups (Email 2 & 3) Remain Safely Locked
            </p>
            <p className="text-blue-700/90 dark:text-blue-300/80">
              Only Email 1 will send now. Follow-up emails will strictly wait until their configured days (e.g. 3-4 days) after Email 1 is delivered.
            </p>
          </div>
        </div>

        <div className="space-y-2 pt-1">
          <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between px-1">
            <span className="flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 text-slate-400" />
              Initial Outreach Ready to Send
            </span>
            <span className="text-[11px] text-slate-400 font-normal">
              Step 1 Emails Only
            </span>
          </div>

          <ScrollArea className="h-[180px] rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/50 p-2">
            <div className="space-y-2">
              {overdueItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-800/90 rounded-lg border border-slate-200/80 dark:border-slate-800 shadow-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-7 w-7 rounded-md bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800 flex items-center justify-center font-bold text-xs shrink-0">
                      E1
                    </div>
                    <div className="truncate">
                      <p className="text-xs font-medium text-slate-900 dark:text-white truncate">
                        {item.recipientEmail}
                      </p>
                      <p className="text-[11px] text-slate-400 truncate">
                        {item.subject || "Important Outreach"}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0 ml-2">
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200/60 dark:border-emerald-800/60">
                      <Clock className="h-2.5 w-2.5" />
                      Ready to Dispatch
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter className="flex flex-row items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button
            type="button"
            variant="ghost"
            disabled={isResuming}
            onClick={() => onOpenChange(false)}
            className="rounded-xl text-xs h-9 text-slate-600 dark:text-slate-400 hover:text-slate-900"
          >
            Keep Paused
          </Button>
          <Button
            type="button"
            disabled={isResuming}
            onClick={handleConfirm}
            className="rounded-xl text-xs h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1.5 shadow-sm px-4 min-w-[150px]"
          >
            {isResuming ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Resuming...
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5 fill-current" />
                Resume Campaign
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

