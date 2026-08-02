"use client";

import type { SequenceStep } from "@prisma/client";
import { formatLocalDisplay } from "@/lib/scheduling";
import { LegacyButton as Button } from "@/components/ui/legacy-adapters";
import { Card, CardContent } from "@/components/ui";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";

interface SequencePreviewProps {
  steps: SequenceStep[];
  prospectName: string;
  prospectEmail: string;
  onClose: () => void;
}

const STEP_LABELS = ["Initial Outreach", "Follow-up #1", "Follow-up #2", "Follow-up #3"];

export default function SequencePreview({
  steps,
  prospectName,
  prospectEmail,
  onClose,
}: SequencePreviewProps) {
  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Sequence Preview</DialogTitle>
          <DialogDescription>
            To: <strong className="text-foreground">{prospectName}</strong>{" "}
            <span className="opacity-80">&lt;{prospectEmail}&gt;</span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 mt-2">
          {steps.map((step, i) => {
            const utcDate = new Date(step.scheduled_at_utc);
            const localDisplay = formatLocalDisplay(utcDate, step.timezone);

            return (
              <Card key={step.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary" className="bg-blue-500/10 text-blue-700 hover:bg-blue-500/20">{i + 1}</Badge>
                      <span className="font-semibold text-foreground">
                        {STEP_LABELS[i] ?? `Email ${i + 1}`}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-foreground">
                        📅 {localDisplay} <span className="text-muted-foreground font-normal">({step.timezone})</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        UTC: {utcDate.toISOString().replace("T", " ").replace(".000Z", " Z")}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 bg-muted/30 p-4 rounded-md border border-border">
                    <div>
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Subject</span>
                      <div className="font-medium text-foreground mt-1">{step.subject}</div>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Body</span>
                      <pre className="m-0 mt-1 whitespace-pre-wrap font-sans text-sm text-foreground leading-relaxed">
                        {step.body}
                      </pre>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>
            Close Preview
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
