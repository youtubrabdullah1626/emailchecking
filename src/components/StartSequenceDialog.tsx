"use client";

import type { SequenceWithSteps } from "@/lib/db/sequences";
import { LegacyButton as Button } from "@/components/ui/legacy-adapters";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";

import { Rocket, AlertCircle } from "lucide-react";

interface StartSequenceDialogProps {
  sequence: SequenceWithSteps;
  prospectName: string;
  onConfirm: () => void;
  onCancel: () => void;
  isStarting: boolean;
  error: string | null;
}

export default function StartSequenceDialog({
  sequence,
  prospectName,
  onConfirm,
  onCancel,
  isStarting,
  error,
}: StartSequenceDialogProps) {
  return (
    <Dialog open={true} onOpenChange={(open) => !open && !isStarting && onCancel()}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden border-border/50 shadow-2xl">
        <div className="px-6 pt-6 pb-4 bg-gradient-to-b from-primary/5 to-transparent">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-semibold tracking-tight">
              <div className="p-2 bg-primary/10 rounded-full">
                <Rocket className="w-5 h-5 text-primary" />
              </div>
              Launch Sequence
            </DialogTitle>
            <DialogDescription className="text-[15px] pt-4 text-foreground/80 leading-relaxed">
              You are about to activate a <strong>{sequence.steps.length}-step</strong> sequence for <strong>{prospectName}</strong>.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-6 pb-6 flex flex-col gap-4">
          <div className="flex items-start gap-3 p-4 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-600/90 text-[13px] leading-relaxed">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p>
              Once launched, the sequence cannot be edited and emails will be immediately queued for scheduling. 
              (Note: Actual sending requires an active Gmail connection).
            </p>
          </div>

          {error && (
            <div className="p-3 bg-destructive/10 text-destructive rounded-xl text-sm font-medium border border-destructive/20">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={onCancel} disabled={isStarting} className="rounded-full px-5">
              Cancel
            </Button>
            <Button 
              variant="primary" 
              onClick={onConfirm} 
              disabled={isStarting} 
              id="confirm-start-sequence-btn"
              className="rounded-full px-6 shadow-md shadow-primary/20 hover:shadow-primary/30 transition-all"
            >
              {isStarting ? "Launching..." : "Launch Sequence"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
