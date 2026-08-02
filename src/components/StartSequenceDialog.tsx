"use client";

import type { SequenceWithSteps } from "@/lib/db/sequences";
import { LegacyButton as Button } from "@/components/ui/legacy-adapters";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";

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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start this sequence?</DialogTitle>
          <DialogDescription className="text-base text-foreground mt-2">
            You are about to activate the <strong>{sequence.steps.length}-step outreach sequence</strong> for <strong>{prospectName}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="p-4 bg-muted/50 rounded-md border border-border">
            <ul className="list-disc pl-5 m-0 text-sm text-foreground flex flex-col gap-2">
              <li>The sequence status will change to <strong>Active</strong>.</li>
              <li>Email steps will be queued for future scheduling.</li>
              <li className="text-warning font-medium">No Gmail email will be sent during this phase.</li>
              <li className="text-warning font-medium">You won&apos;t be able to edit the sequence once it starts.</li>
            </ul>
          </div>

          {error && (
            <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={onCancel} disabled={isStarting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onConfirm} disabled={isStarting} id="confirm-start-sequence-btn">
            {isStarting ? "Starting…" : "Yes, Start Sequence"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
