"use client";

import React, { useState, useEffect } from "react";
import { useImport } from "@/components/providers/ImportProvider";
import { useWarmup } from "@/components/providers/WarmupProvider";
import { CampaignSequence, SequenceStep } from "@/lib/import/engines/SequenceBuilderEngine";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Mail, CheckCircle2, ChevronRight, Check } from "lucide-react";
import { SequenceSummary } from "./SequenceSummary";

export function SequencePreviewWorkspace() {
  const { getSequences, startScheduling } = useImport() as any;
  const { status: warmupStatus, settings: warmupSettings } = useWarmup();
  const [sequences, setSequences] = useState<CampaignSequence[]>([]);
  const [selectedSequence, setSelectedSequence] = useState<CampaignSequence | null>(null);
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 50;

  useEffect(() => {
    // We only load a chunk of the sequences into state to prevent memory bloat
    const allSeqs = getSequences();
    setSequences(allSeqs.slice(0, ITEMS_PER_PAGE * page));
    if (allSeqs.length > 0 && !selectedSequence) {
      setSelectedSequence(allSeqs[0]);
    }
  }, [getSequences, page, selectedSequence]); // Only strictly needed dependencies

  const handleLoadMore = () => setPage(p => p + 1);
  const totalAvailable = getSequences().length;
  const hasMore = sequences.length < totalAvailable;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SequenceSummary />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
        {/* Master List (Paginated) */}
        <Card className="lg:col-span-1 border-border shadow-sm flex flex-col overflow-hidden h-full">
          <CardHeader className="bg-muted/5 border-b border-border py-3">
            <CardTitle className="text-sm font-semibold flex items-center justify-between">
              <span>Sequence Blueprints</span>
              <Badge variant="secondary">{totalAvailable.toLocaleString()} Total</Badge>
            </CardTitle>
          </CardHeader>
          <ScrollArea className="flex-1">
            <div className="p-3 space-y-2">
              {sequences.map(seq => (
                <div 
                  key={seq.recordId}
                  onClick={() => setSelectedSequence(seq)}
                  className={`p-3 rounded-md border text-sm cursor-pointer transition-colors flex items-center justify-between ${
                    selectedSequence?.recordId === seq.recordId 
                      ? "border-primary bg-primary/5" 
                      : "border-border hover:border-primary/30 hover:bg-muted/30"
                  }`}
                >
                  <div className="truncate pr-2">
                    <div className="font-medium truncate">{seq.recipientEmail}</div>
                    <div className="text-xs text-muted-foreground">{seq.steps.length} Steps</div>
                  </div>
                  <ChevronRight className={`h-4 w-4 flex-shrink-0 ${selectedSequence?.recordId === seq.recordId ? "text-primary" : "text-muted-foreground"}`} />
                </div>
              ))}
              
              {hasMore && (
                <Button variant="ghost" className="w-full text-xs mt-2" onClick={handleLoadMore}>
                  Load More ({sequences.length} / {totalAvailable})
                </Button>
              )}
            </div>
          </ScrollArea>
        </Card>

        {/* Detail Panel */}
        <Card className="lg:col-span-2 border-border shadow-sm flex flex-col overflow-hidden h-full">
          <CardHeader className="bg-muted/5 border-b border-border py-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary" />
              Timeline Preview: <span className="font-normal text-muted-foreground">{selectedSequence?.recipientEmail}</span>
            </CardTitle>
          </CardHeader>
          <ScrollArea className="flex-1 bg-muted/10">
            <div className="p-6">
              {selectedSequence ? (
                <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
                  {selectedSequence.steps.map((step: SequenceStep, index: number) => (
                    <div key={step.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full border border-primary/30 bg-background text-primary shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                        {step.stepNumber}
                      </div>
                      <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded border border-border bg-background shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant={index === 0 ? "default" : "secondary"} className="text-[10px]">
                            {index === 0 ? "Initial Email" : `Follow-up ${index}`}
                          </Badge>
                          {index > 0 && <span className="text-xs text-muted-foreground">Day {step.delayDays}</span>}
                        </div>
                        <div className="text-sm text-foreground whitespace-pre-wrap font-mono bg-muted/30 p-3 rounded-md border border-border/50 text-xs transition-all relative">
                          <div className="font-semibold text-foreground/90 mb-2 pb-2 border-b border-border/50">
                            Subject: {step.subject}
                          </div>
                          <div className="line-clamp-6 hover:line-clamp-none transition-all">
                            {step.content}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {/* End of Sequence */}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground space-y-4 py-20">
                  <Mail className="h-12 w-12 opacity-20" />
                  <p>Select a sequence blueprint to view</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </Card>
      </div>

      <div className="flex items-center justify-end pt-4 border-t border-border">
        <Button onClick={() => startScheduling(warmupStatus, warmupSettings)} className="gap-2 shadow-md">
          <Check className="h-4 w-4" />
          Compile Execution Plan
        </Button>
      </div>
    </div>
  );
}
