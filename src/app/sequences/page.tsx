"use client";

import React, { useEffect, useState, useMemo, useRef, useCallback, useDeferredValue } from "react";
import { FastLink } from "@/components/ui/fast-link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Plus,
  MoreHorizontal,
  PlayCircle,
  PauseCircle,
  CheckCircle2,
  Trash2,
  Info,
  ExternalLink,
  Search,
  X,
  Layers,
  Send,
  Sparkles,
  ArrowUpRight,
  Clock,
  Inbox,
  RefreshCw,
  Eye,
  MessageSquareReply,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import useSWR from "swr";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  } | null;
  steps: StepItem[];
}

// Avatar color helper
const AVATAR_COLORS = [
  "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200/60",
  "bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200/60",
  "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200/60",
  "bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200/60",
  "bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200/60",
  "bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-200/60",
];

function getAvatarColor(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

// Helper to compute accurate sequence status
function computeSequenceState(seq: SequenceDetail) {
  const totalSteps = seq.steps?.length ?? 0;
  const sentSteps = seq.steps?.filter((s) => s.status === "SENT").length ?? 0;
  const pendingSteps =
    seq.steps
      ?.filter((s) => s.status === "PENDING")
      .sort((a, b) => new Date(a.scheduled_at_utc).getTime() - new Date(b.scheduled_at_utc).getTime()) ?? [];

  const isCompleted =
    seq.status === "COMPLETED" ||
    (totalSteps > 0 && sentSteps === totalSteps && pendingSteps.length === 0);

  const isPaused = seq.status === "STOPPED" || seq.status === "PAUSED";
  const isDraft = seq.status === "DRAFT";
  const isActive = seq.status === "ACTIVE" && !isCompleted && !isPaused;

  const nextSendAt = pendingSteps[0]?.scheduled_at_utc;
  const completionPercent = totalSteps > 0 ? Math.round((sentSteps / totalSteps) * 100) : 0;

  const currentStepNum = isCompleted
    ? totalSteps
    : (seq.steps?.find((s) => s.status === "PROCESSING" || s.status === "PENDING")?.step_number ?? (sentSteps > 0 ? sentSteps : 1));

  let statusKey: "ACTIVE" | "COMPLETED" | "PAUSED" | "DRAFT" = "ACTIVE";
  if (isCompleted) statusKey = "COMPLETED";
  else if (isPaused) statusKey = "PAUSED";
  else if (isDraft) statusKey = "DRAFT";

  return {
    statusKey,
    isCompleted,
    isPaused,
    isActive,
    isDraft,
    totalSteps,
    sentSteps,
    pendingSteps,
    nextSendAt,
    completionPercent,
    currentStepNum,
  };
}

export default function SequencesPage() {
  const router = useRouter();
  const [sequenceToDelete, setSequenceToDelete] = useState<{ id: string; name: string } | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "COMPLETED" | "PAUSED">("ALL");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const deleteTimers = useRef<Record<string, NodeJS.Timeout>>({});
  const deletedSequencesRef = useRef<Record<string, SequenceDetail>>({});

  // Keyboard shortcut listener (/ or Ctrl+K to search)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.key === "k" && (e.metaKey || e.ctrlKey)) ||
        (e.key === "/" && document.activeElement !== searchInputRef.current)
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const { data, error: swrError, isLoading: loading, isValidating: isRefreshing, mutate } = useSWR(
    "/api/sequences",
    async (url: string) => {
      const res = await fetch(url);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to load sequences.");
      }
      return res.json();
    },
    {
      refreshInterval: 5000,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 2000,
      keepPreviousData: true,
    }
  );

  const sequences = useMemo(() => {
    const rawList = (data?.data ?? []) as SequenceDetail[];
    return rawList.sort((a: SequenceDetail, b: SequenceDetail) => {
      const stateA = computeSequenceState(a);
      const stateB = computeSequenceState(b);
      if (stateA.isActive && !stateB.isActive) return -1;
      if (!stateA.isActive && stateB.isActive) return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [data?.data]);

  const error = swrError?.message ?? null;
  const loadSequences = (isSilent = false) => { mutate(); };

  const confirmDeleteSequence = () => {
    if (!sequenceToDelete) return;
    const { id, name } = sequenceToDelete;

    setSequenceToDelete(null);

    const targetSeq = sequences.find((s) => s.id === id);
    if (targetSeq) {
      deletedSequencesRef.current[id] = targetSeq;
    }

    if (deleteTimers.current[id]) {
      clearTimeout(deleteTimers.current[id]);
    }

    mutate((currentData: any) => {
      if (!currentData) return currentData;
      return {
        ...currentData,
        data: (currentData.data || []).filter((s: SequenceDetail) => s.id !== id),
      };
    }, false);

    const timer = setTimeout(async () => {
      delete deleteTimers.current[id];
      delete deletedSequencesRef.current[id];
      try {
        const res = await fetch(`/api/sequences/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Failed to delete sequence on server");
      } catch (err: any) {
        toast.error(err.message || "Failed to delete sequence on server");
      }
    }, 6000);

    deleteTimers.current[id] = timer;

    toast.success(`Sequence deleted`, {
      description: name ? `For ${name}` : undefined,
      action: {
        label: "Undo",
        onClick: () => {
          if (deleteTimers.current[id]) {
            clearTimeout(deleteTimers.current[id]);
            delete deleteTimers.current[id];
          }

          const restored = deletedSequencesRef.current[id];
          delete deletedSequencesRef.current[id];

          if (restored) {
            mutate((currentData: any) => {
              if (!currentData) return currentData;
              const list = currentData.data || [];
              if (list.some((s: SequenceDetail) => s.id === id)) return currentData;
              return {
                ...currentData,
                data: [restored, ...list],
              };
            }, false);
          }
          toast.info("Sequence restored");
        },
      },
      duration: 5500,
    });
  };

  // Summary Metrics
  const stats = useMemo(() => {
    let active = 0;
    let completed = 0;
    let paused = 0;

    sequences.forEach((seq) => {
      const state = computeSequenceState(seq);
      if (state.isActive) active++;
      else if (state.isCompleted) completed++;
      else if (state.isPaused) paused++;
    });

    return {
      total: sequences.length,
      active,
      completed,
      paused,
    };
  }, [sequences]);

  const deferredSearch = useDeferredValue(search);

  // Filtered List
  const filteredSequences = useMemo(() => {
    return sequences.filter((seq) => {
      const state = computeSequenceState(seq);

      if (statusFilter === "ACTIVE" && !state.isActive) return false;
      if (statusFilter === "COMPLETED" && !state.isCompleted) return false;
      if (statusFilter === "PAUSED" && !state.isPaused) return false;

      if (deferredSearch && deferredSearch.trim()) {
        const q = deferredSearch.toLowerCase().trim();
        const matchName = seq.prospect?.name?.toLowerCase().includes(q);
        const matchEmail = seq.prospect?.email?.toLowerCase().includes(q);
        const matchCompany = seq.prospect?.company?.toLowerCase().includes(q);
        const matchSubject = seq.steps?.some((s) => s.subject?.toLowerCase().includes(q));
        if (!matchName && !matchEmail && !matchCompany && !matchSubject) {
          return false;
        }
      }

      return true;
    });
  }, [sequences, statusFilter, deferredSearch]);

  if (error) {
    return (
      <div className="min-h-screen p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
        <div className="p-4 bg-destructive/10 text-destructive rounded-xl font-medium flex justify-between items-center" role="alert">
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={() => loadSequences()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* 1. Dynamic Silaer Signature Header */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-xs relative overflow-hidden transition-colors duration-200">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start sm:items-center gap-4">
            <div className="h-11 w-11 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
              <Layers className="h-5 w-5" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-bold text-foreground tracking-tight">
                  Outreach Sequences
                </h1>
                <TooltipProvider>
                  <Tooltip delayDuration={200}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="flex items-center justify-center h-5 w-5 rounded-full bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-help border border-border"
                      >
                        <Info className="h-3 w-3" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" align="center" className="max-w-xs p-3 bg-popover border border-border shadow-md rounded-lg z-50 text-xs">
                      <p className="font-semibold text-foreground mb-1">
                        What is an Outreach Sequence?
                      </p>
                      <p className="text-muted-foreground leading-relaxed">
                        An automated chain of emails. The engine handles follow-ups, timezone optimization, and reply detection automatically.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
                Automated multi-step outreach with automated reply detection and timezone delivery.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 self-start md:self-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadSequences(true)}
              disabled={loading}
              className="gap-1.5 text-xs h-9"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-muted-foreground ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>

            <Button size="sm" className="gap-2 text-xs h-9 px-4" asChild>
              <FastLink href="/sequences/new">
                <Plus className="h-4 w-4 stroke-[2.5]" />
                <span>Create Sequence</span>
              </FastLink>
            </Button>
          </div>
        </div>
      </div>

      {/* 2. Overview Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-card border border-border rounded-xl p-4 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Total Sequences
            </div>
            <div className="text-2xl font-extrabold text-foreground font-mono mt-1 tracking-tight">
              {stats.total}
            </div>
          </div>
          <div className="h-9 w-9 rounded-lg bg-secondary text-foreground flex items-center justify-center border border-border">
            <Layers className="h-4 w-4 text-primary" />
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Active Outbound
            </div>
            <div className="text-2xl font-extrabold text-foreground font-mono mt-1 tracking-tight">
              {stats.active}
            </div>
          </div>
          <div className="h-9 w-9 rounded-lg bg-secondary text-foreground flex items-center justify-center border border-border">
            <PlayCircle className="h-4 w-4 text-emerald-500" />
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Completed
            </div>
            <div className="text-2xl font-extrabold text-foreground font-mono mt-1 tracking-tight">
              {stats.completed}
            </div>
          </div>
          <div className="h-9 w-9 rounded-lg bg-secondary text-foreground flex items-center justify-center border border-border">
            <CheckCircle2 className="h-4 w-4 text-blue-500" />
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Paused / Stopped
            </div>
            <div className="text-2xl font-extrabold text-foreground font-mono mt-1 tracking-tight">
              {stats.paused}
            </div>
          </div>
          <div className="h-9 w-9 rounded-lg bg-secondary text-foreground flex items-center justify-center border border-border">
            <PauseCircle className="h-4 w-4 text-amber-500" />
          </div>
        </div>
      </div>

      {/* 3. Filter and Search Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            autoComplete="off"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search prospect, company, email, or subject... (Press / to search)"
            className="w-full pl-10 pr-12 py-2 bg-card border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring transition-all shadow-2xs h-9"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {search ? (
              <button
                onClick={() => setSearch("")}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : (
              <kbd className="hidden sm:inline-block text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-secondary text-muted-foreground border border-border">
                /
              </kbd>
            )}
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="inline-flex bg-secondary p-1 rounded-lg border border-border shadow-2xs text-xs gap-1">
          {[
            { key: "ALL", label: "All", count: stats.total },
            { key: "ACTIVE", label: "Active", count: stats.active },
            { key: "COMPLETED", label: "Completed", count: stats.completed },
            { key: "PAUSED", label: "Paused", count: stats.paused },
          ].map((tab) => {
            const isActive = statusFilter === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key as any)}
                className={`px-3 py-1 rounded-md font-semibold text-xs flex items-center gap-1.5 transition-all ${
                  isActive
                    ? "bg-card text-foreground shadow-xs border border-border font-bold"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/80"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                    isActive
                      ? "bg-secondary text-foreground font-bold font-mono"
                      : "bg-background/60 text-muted-foreground font-mono"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Sequence Table List */}
      {loading ? (
        <div className="bg-card border border-border rounded-xl p-4 shadow-xs space-y-3">
          {Array.from({ length: 5 }).map((_, idx) => (
            <div key={idx} className="h-14 bg-secondary/60 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : filteredSequences.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-xl border border-border shadow-xs">
          <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground mx-auto mb-3 border border-border">
            <Inbox className="h-5 w-5" />
          </div>
          <h3 className="text-sm font-semibold text-foreground mb-1">
            {search ? `No sequences match "${search}"` : "No sequences found in this view"}
          </h3>
          <p className="text-muted-foreground text-xs max-w-sm mx-auto mb-5">
            {search ? "Try adjusting your search query." : "Launch automated sequences for your prospects to get started."}
          </p>
          <Button size="sm" className="text-xs" asChild>
            <FastLink href="/prospects">Create Sequence</FastLink>
          </Button>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-secondary/50 border-b border-border text-muted-foreground font-semibold text-[11px] uppercase tracking-wider">
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="w-[340px] py-3 px-4 text-muted-foreground">Prospect & Sequence</TableHead>
                  <TableHead className="w-[220px] py-3 px-3 text-muted-foreground">Status & Schedule</TableHead>
                  <TableHead className="py-3 px-3 text-muted-foreground">Progress</TableHead>
                  <TableHead className="text-right w-[100px] py-3 px-4 text-muted-foreground">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-border">
                {filteredSequences.map((seq) => {
                  const state = computeSequenceState(seq);
                  const firstSubject = seq.steps?.[0]?.subject;
                  const prospectName = seq.prospect?.name || seq.prospect?.email || "Unknown Lead";
                  const avatarStyle = getAvatarColor(seq.prospect?.email || seq.id);
                  const targetUrl = seq.prospect ? `/prospects/${seq.prospect.id}/sequence` : "#";

                  // Clean company name (ignore "Unknown", "null", etc.)
                  const cleanCompany =
                    seq.prospect?.company &&
                    seq.prospect.company.toLowerCase() !== "unknown" &&
                    seq.prospect.company.toLowerCase() !== "null"
                      ? seq.prospect.company
                      : null;

                  return (
                    <TableRow
                      key={seq.id}
                      onClick={() => {
                        if (seq.prospect) {
                          router.push(targetUrl);
                        }
                      }}
                      className="group cursor-pointer hover:bg-secondary/60 transition-colors"
                    >
                      {/* Prospect & Subject */}
                      <TableCell className="py-3 px-4">
                        <div className="flex items-start gap-3">
                          <div
                            className={`h-9 w-9 rounded-xl font-bold text-xs flex items-center justify-center shrink-0 border mt-0.5 shadow-2xs ${avatarStyle}`}
                          >
                            {prospectName.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors truncate max-w-xs">
                              {firstSubject || `Sequence for ${prospectName}`}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5 truncate max-w-xs">
                              to <span className="font-medium text-foreground">{prospectName}</span>
                              {cleanCompany && <span className="text-muted-foreground"> at {cleanCompany}</span>}
                            </div>
                          </div>
                        </div>
                      </TableCell>

                      {/* Status & Schedule (Accurate & Non-Redundant) */}
                      <TableCell className="py-3 px-3">
                        <div className="flex flex-col items-start gap-1">
                          {state.isCompleted ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold text-[11px] border border-emerald-500/20 shadow-2xs">
                              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                              <span>Completed</span>
                            </span>
                          ) : state.isPaused ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 font-semibold text-[11px] border border-amber-500/20 shadow-2xs">
                              <PauseCircle className="h-3 w-3 text-amber-600" />
                              <span>Paused</span>
                            </span>
                          ) : state.isDraft ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-secondary text-muted-foreground font-medium text-[11px] border border-border">
                              <span>Draft</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold text-[11px] border border-emerald-500/20 shadow-2xs">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              <span>Active</span>
                            </span>
                          )}

                          {/* Subtext description */}
                          <div className="text-[11px] text-muted-foreground">
                            {state.isCompleted ? (
                              <span className="text-muted-foreground">
                                All {state.totalSteps} {state.totalSteps === 1 ? "step" : "steps"} finished
                              </span>
                            ) : state.nextSendAt && state.isActive ? (
                              <span className="text-foreground font-medium flex items-center gap-1">
                                <Clock className="h-3 w-3 text-amber-500" />
                                Next: {formatDistanceToNow(new Date(state.nextSendAt), { addSuffix: true })}
                              </span>
                            ) : state.isPaused ? (
                              <span className="text-muted-foreground">
                                {state.sentSteps} of {state.totalSteps} steps sent
                              </span>
                            ) : (
                              <span className="text-muted-foreground">No pending follow-ups</span>
                            )}
                          </div>
                        </div>
                      </TableCell>

                      {/* Progress Bar */}
                      <TableCell className="py-3 px-3">
                        <div className="flex flex-col gap-1.5 w-full pr-6">
                          <div className="flex justify-between text-[11px] font-medium text-muted-foreground">
                            <span>
                              {state.isCompleted
                                ? `${state.totalSteps} of ${state.totalSteps} steps completed`
                                : `Step ${state.currentStepNum} of ${state.totalSteps}`}
                            </span>
                            <span className="font-semibold text-foreground font-mono">
                              {state.completionPercent}%
                            </span>
                          </div>
                          <Progress
                            value={state.completionPercent}
                            className={`h-1.5 ${state.isCompleted ? "bg-emerald-100 [&>div]:bg-emerald-600" : ""}`}
                          />
                        </div>
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {seq.prospect && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2 text-muted-foreground hover:text-foreground text-xs font-medium"
                              asChild
                            >
                              <FastLink href={targetUrl}>
                                <span className="hidden sm:inline mr-1">Inspect</span>
                                <ArrowUpRight className="h-3.5 w-3.5" />
                              </FastLink>
                            </Button>
                          )}

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44 rounded-xl shadow-lg border border-border bg-popover">
                              {seq.prospect && (
                                <DropdownMenuItem asChild>
                                  <FastLink href={targetUrl} className="cursor-pointer">
                                    <ExternalLink className="mr-2 h-3.5 w-3.5" />
                                    View Details
                                  </FastLink>
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() =>
                                  setSequenceToDelete({
                                    id: seq.id,
                                    name: seq.prospect?.name ? `Sequence for ${seq.prospect.name}` : "Sequence",
                                  })
                                }
                                className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer"
                              >
                                <Trash2 className="mr-2 h-3.5 w-3.5" />
                                Delete Sequence
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Footer Bar */}
          <div className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex items-center justify-between text-[11px] text-slate-400">
            <span>
              Showing <strong className="text-slate-700 dark:text-slate-200">{filteredSequences.length}</strong> of {sequences.length} sequences
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span>Smart Follow-up Engine Active</span>
            </span>
          </div>
        </div>
      )}

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog open={!!sequenceToDelete} onOpenChange={() => setSequenceToDelete(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Sequence?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this sequence? You will have a 6-second window to undo this action.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteSequence}
              className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
