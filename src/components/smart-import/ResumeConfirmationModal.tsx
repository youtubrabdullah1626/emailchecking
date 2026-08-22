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
import { Clock, Play, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface OverdueEmailItem {
  id: string;
  recipientEmail: string;
  stepNumber: number;
  subject?: string;
  scheduledTime: string;
  scheduledDate: string;
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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!isResuming) onOpenChange(open); }}>
      <DialogContent className="max-w-lg rounded-2xl shadow-2xl border-slate-200 dark:border-slate-800">
        <DialogHeader className="space-y-2">
          <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-slate-100 text-lg font-bold">
            <div className="h-8 w-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
              <Play className="h-4 w-4 fill-current" />
            </div>
            <span>Resume Campaign</span>
            <Badge variant="outline" className="ml-auto bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-300 font-semibold text-xs">
              {overdueItems.length} Due Now
            </Badge>
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
            The following <strong>{overdueItems.length} {overdueItems.length === 1 ? "email was" : "emails were"}</strong> scheduled for earlier today while the campaign was paused. Resuming will begin sending {overdueItems.length === 1 ? "it" : "them"} immediately.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 space-y-2">
          <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 px-1">
            <Clock className="h-3.5 w-3.5 text-slate-400" />
            <span>Emails Ready for Dispatch</span>
          </div>

          <ScrollArea className="h-[200px] rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 p-2">
            <div className="space-y-2">
              {overdueItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-800/80 rounded-lg border border-slate-100 dark:border-slate-800 shadow-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-7 w-7 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center font-bold text-xs shrink-0">
                      S{item.stepNumber}
                    </div>
                    <div className="truncate">
                      <p className="text-xs font-medium text-slate-900 dark:text-white truncate">
                        {item.recipientEmail}
                      </p>
                      <p className="text-[11px] text-slate-400 truncate">
                        {item.subject || "(Standard Follow-up)"}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0 ml-2">
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md border border-amber-200/50">
                      <Clock className="h-2.5 w-2.5" />
                      Due ({item.scheduledTime || "Now"})
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter className="flex flex-row items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <Button
            type="button"
            variant="ghost"
            disabled={isResuming}
            onClick={() => onOpenChange(false)}
            className="rounded-xl text-xs h-9"
          >
            Keep Paused
          </Button>
          <Button
            type="button"
            disabled={isResuming}
            onClick={handleConfirm}
            className="rounded-xl text-xs h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1.5 shadow-sm min-w-[150px]"
          >
            {isResuming ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Dispatching Now...
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5 fill-current" />
                Resume & Send Now
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
