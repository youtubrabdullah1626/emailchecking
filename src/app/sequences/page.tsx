"use client";

import { useEffect, useState } from "react";
import { FastLink } from "@/components/ui/fast-link";
import { PageHeader } from "@/components/ui/page-header";
import { AnimatedPage, AnimatedList, AnimatedItem } from "@/components/ui/animated";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Progress } from "@/components/ui/progress";
import { Plus, MoreHorizontal, PlayCircle, PauseCircle, CheckCircle2, Trash2, Info, ExternalLink } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatDistanceToNow, format } from "date-fns";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
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

  const handleDelete = async (id: string, name?: string) => {
    // 1. Immediately remove from state (0ms delay!)
    const previousSequences = [...sequences];
    setSequences(prev => prev.filter(s => s.id !== id));

    // 2. Show instant toast with Undo
    let isUndone = false;
    toast.success(`Sequence deleted`, {
      description: name ? `For ${name}` : undefined,
      action: {
        label: "Undo",
        onClick: () => {
          isUndone = true;
          setSequences(previousSequences);
          toast.info("Sequence deletion cancelled");
        }
      },
      duration: 4000
    });

    // 3. Delete in background asynchronously
    setTimeout(async () => {
      if (isUndone) return;
      try {
        const res = await fetch(`/api/sequences/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Failed to delete sequence on server");
      } catch (err: any) {
        setSequences(previousSequences);
        toast.error(err.message || "Failed to delete sequence");
      }
    }, 400);
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
        // Sort sequences: Active first, then by created_at descending
        const sortedSequences = (json.data ?? []).sort((a: SequenceDetail, b: SequenceDetail) => {
          if (a.status === 'ACTIVE' && b.status !== 'ACTIVE') return -1;
          if (a.status !== 'ACTIVE' && b.status === 'ACTIVE') return 1;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
        setSequences(sortedSequences);
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
        title={
          <div className="flex items-center gap-2.5">
            Sequences
            <TooltipProvider>
              <Tooltip delayDuration={200}>
                <TooltipTrigger asChild>
                  <button type="button" className="flex items-center justify-center h-6 w-6 rounded-full bg-muted/50 text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors focus:outline-none cursor-help mt-1">
                    <Info className="h-3.5 w-3.5" strokeWidth={2.5} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" align="center" className="max-w-[280px] p-4 bg-white border border-slate-200 shadow-xl rounded-xl z-50">
                  <p className="font-semibold text-slate-900 mb-2">
                    What is a Sequence?
                  </p>
                  <div className="text-slate-600 text-xs leading-relaxed space-y-2">
                    <p>A sequence is an automated chain of emails.</p>
                    <p>Just set the schedule, and the Smart Engine handles all follow-ups perfectly on time! ⚡</p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        } 
        description="Active outreach campaigns running for your prospects."
      >
        <Button className="gap-2" asChild>
          <Link prefetch={true} href="/prospects">
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
            <Link prefetch={true} href="/prospects">Create Sequence</Link>
          </Button>
        </div>
      ) : (
        <Card className="overflow-hidden border-border/50 shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="w-[300px]">Prospect & Sequence</TableHead>
                    <TableHead className="w-[200px]">Status & Schedule</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead className="text-right w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
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
                      <TableRow key={seq.id} className="group cursor-default hover:bg-muted/30">
                        <TableCell>
                          <div className="flex items-start gap-3">
                            <Avatar className="h-9 w-9 mt-0.5 border border-border shadow-sm group-hover:scale-105 transition-transform">
                              <AvatarFallback className="bg-primary/5 text-primary text-xs font-medium">
                                {seq.prospect.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col">
                              <Link prefetch={true} href={`/prospects/${seq.prospect.id}/sequence`} className="font-semibold text-sm hover:text-primary transition-colors line-clamp-1">
                                {firstSubject || `Sequence for ${seq.prospect.name}`}
                              </Link>
                              <span className="text-xs text-muted-foreground mt-0.5">
                                to <Link prefetch={true} href={`/prospects/${seq.prospect.id}`} className="font-medium text-foreground hover:underline">{seq.prospect.name}</Link>
                                {seq.prospect.company && ` at ${seq.prospect.company}`}
                              </span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col items-start gap-1.5">
                            <StatusBadge status={badgeStatus as any} dot />
                            <div className="text-[11px] text-muted-foreground mt-0.5">
                              {seq.status === 'COMPLETED' ? (
                                <span className="flex items-center gap-1 text-emerald-600 font-medium">
                                  <CheckCircle2 className="h-3 w-3" /> Finished
                                </span>
                              ) : nextSendAt && seq.status === 'ACTIVE' ? (
                                <span className="text-foreground font-medium">Next: {formatDistanceToNow(new Date(nextSendAt), { addSuffix: true })}</span>
                              ) : seq.status === 'STOPPED' ? (
                                <span className="flex items-center gap-1 text-amber-600 font-medium">
                                  <PauseCircle className="h-3 w-3" /> Paused
                                </span>
                              ) : (
                                "No pending steps"
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1.5 w-full pr-8">
                            <div className="flex justify-between text-[10px] font-medium text-muted-foreground">
                              <span>Step {currentStepNum} of {totalSteps}</span>
                              <span>{completionPercent}%</span>
                            </div>
                            <Progress value={completionPercent} className="h-1.5" />
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity" disabled={deletingId === seq.id}>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <FastLink href={`/prospects/${seq.prospect.id}/sequence`} className="cursor-pointer">
                                  <ExternalLink className="mr-2 h-4 w-4" />
                                  View Sequence
                                </FastLink>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => handleDelete(seq.id, seq.prospect?.name)}
                                className="text-destructive focus:bg-destructive focus:text-destructive-foreground cursor-pointer"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete Sequence
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </AnimatedPage>
  );
}
