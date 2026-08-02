"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { AnimatedPage, AnimatedList, AnimatedItem } from "@/components/ui/animated";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Progress } from "@/components/ui/progress";
import { Plus, MoreHorizontal, PlayCircle, PauseCircle, CheckCircle2, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface StepItem {
  id: string;
  step_number: number;
  subject: string;
  status: string;
  scheduled_at_utc: string;
  sent_at: string | null;
}

interface SequenceDetail {
  id: string;
  status: string;
  created_at: string;
  started_at: string | null;
  stopped_at: string | null;
  prospect: {
    id: string;
    name: string;
    company: string;
    email: string;
    status: string;
  };
  steps: StepItem[];
}

export default function SequencesPage() {
  const [sequences, setSequences] = useState<SequenceDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this sequence?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/sequences/${id}`, { method: "DELETE" });
      if (!res.ok) {
        throw new Error("Failed to delete sequence");
      }
      setSequences(prev => prev.filter(s => s.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete sequence");
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    async function loadSequences() {
      setError(null);
      try {
        const res = await fetch("/api/sequences");
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to load sequences.");
        }
        const json = await res.json();
        setSequences(json.data ?? []);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to load sequences.";
        setError(msg);
      } finally {
        setLoading(false);
      }
    }
    loadSequences();
  }, []);

  if (error) {
    return (
      <AnimatedPage className="space-y-6">
        <PageHeader title="Sequences" description="Active outreach campaigns running for your prospects." />
        <div className="p-4 bg-destructive/10 text-destructive rounded-md font-medium flex justify-between items-center" role="alert">
          {error}
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </AnimatedPage>
    );
  }

  return (
    <AnimatedPage className="space-y-6">
      <PageHeader 
        title="Sequences" 
        description="Active outreach campaigns running for your prospects."
      >
        <Button className="gap-2" asChild>
          <Link href="/prospects">
            <Plus className="h-4 w-4" />
            Create Sequence
          </Link>
        </Button>
      </PageHeader>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <div key={i} className="h-48 bg-muted rounded-xl animate-pulse" />)}
        </div>
      ) : sequences.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-xl border border-dashed border-border shadow-sm">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground mx-auto mb-4">
            <PlayCircle className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-medium text-foreground mb-1">No active sequences</h3>
          <p className="text-muted-foreground text-sm max-w-sm mx-auto mb-6">
            Create your first sequence to start automating your outreach. You can add multiple steps with delays between them.
          </p>
          <Button asChild>
            <Link href="/prospects">Create Sequence</Link>
          </Button>
        </div>
      ) : (
        <AnimatedList className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sequences.map(seq => {
            const totalSteps = seq.steps.length;
            const sentSteps = seq.steps.filter((s) => s.status === "SENT").length;
            
            const activeStep =
              seq.steps.find((s) => s.status === "PROCESSING") ??
              seq.steps.find((s) => s.status === "PENDING");
            
            const currentStepNum = activeStep ? activeStep.step_number : (seq.status === "COMPLETED" ? totalSteps : 1);
            const completionPercent = totalSteps > 0 ? Math.round((sentSteps / totalSteps) * 100) : 0;
            
            const pendingSteps = seq.steps
              .filter((s) => s.status === "PENDING")
              .sort((a, b) => new Date(a.scheduled_at_utc).getTime() - new Date(b.scheduled_at_utc).getTime());
            
            const nextSendAt = pendingSteps[0]?.scheduled_at_utc;
            const firstSubject = seq.steps[0]?.subject;
            
            let badgeStatus = seq.status.toLowerCase();
            if (badgeStatus === 'draft') badgeStatus = 'none';

            return (
              <AnimatedItem key={seq.id}>
                <Card className="hover-elevate transition-shadow border-border h-full flex flex-col group">
                  <CardContent className="p-6 flex flex-col h-full relative">
                    <div className="flex justify-between items-start mb-4">
                      <StatusBadge status={badgeStatus as any} dot />
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 -mt-2 -mr-2 opacity-0 group-hover:opacity-100 transition-opacity"
                            disabled={deletingId === seq.id}
                          >
                            <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem 
                            onClick={() => handleDelete(seq.id)}
                            className="text-destructive focus:bg-destructive focus:text-destructive-foreground cursor-pointer"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete Sequence
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    
                    <div className="mb-6 flex-1">
                      <Link href={`/prospects/${seq.prospect.id}/sequence`} className="block">
                        <h3 className="font-semibold text-lg hover:text-primary transition-colors mb-1 line-clamp-2">
                          {firstSubject || `Sequence for ${seq.prospect.name}`}
                        </h3>
                      </Link>
                      <p className="text-sm text-muted-foreground">
                        Prospect: <Link href={`/prospects/${seq.prospect.id}`} className="font-medium text-foreground hover:underline">{seq.prospect.name}</Link>
                      </p>
                      {seq.prospect.company && (
                        <p className="text-xs text-muted-foreground mt-0.5">{seq.prospect.company}</p>
                      )}
                    </div>
                    
                    <div className="space-y-3 mt-auto">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-medium">Step {currentStepNum} of {totalSteps}</span>
                        <span className="text-muted-foreground">{completionPercent}%</span>
                      </div>
                      <Progress value={completionPercent} className="h-2" />
                      
                      <div className="flex items-center justify-between pt-4 border-t border-border mt-4">
                        <div className="text-xs text-muted-foreground">
                          {seq.status === 'COMPLETED' ? (
                            <span className="flex items-center gap-1 text-emerald-600 font-medium">
                              <CheckCircle2 className="h-3 w-3" /> Completed
                            </span>
                          ) : nextSendAt && seq.status === 'ACTIVE' ? (
                            <span>Next send: {formatDistanceToNow(new Date(nextSendAt), { addSuffix: true })}</span>
                          ) : seq.status === 'STOPPED' ? (
                            <span className="flex items-center gap-1 text-amber-600 font-medium">
                              <PauseCircle className="h-3 w-3" /> Stopped
                            </span>
                          ) : (
                            "No pending steps"
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </AnimatedItem>
            );
          })}
        </AnimatedList>
      )}
    </AnimatedPage>
  );
}
