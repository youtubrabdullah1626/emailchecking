"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
import { FastLink } from "@/components/ui/fast-link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
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
  Activity,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
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
  };
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
  const pendingSteps = seq.steps
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
    : (seq.steps?.find((s) => s.status === "PROCESSING" || s.status === "PENDING")?.step_number ?? 1);

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
  const [sequences, setSequences] = useState<SequenceDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sequenceToDelete, setSequenceToDelete] = useState<{ id: string; name: string } | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "COMPLETED" | "PAUSED">("ALL");

  const deleteTimers = useRef<Record<string, NodeJS.Timeout>>({});
  const deletedSequencesRef = useRef<Record<string, SequenceDetail>>({});

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

    setSequences((prev) => prev.filter((s) => s.id !== id));

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
            setSequences((prev) => {
              if (prev.some((s) => s.id === id)) return prev;
              return [restored, ...prev];
            });
          }
          toast.info("Sequence restored");
        },
      },
      duration: 5500,
    });
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
        const sortedSequences = (json.data ?? []).sort((a: SequenceDetail, b: SequenceDetail) => {
          const stateA = computeSequenceState(a);
          const stateB = computeSequenceState(b);
          if (stateA.isActive && !stateB.isActive) return -1;
          if (!stateA.isActive && stateB.isActive) return 1;
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

  // Filtered List
  const filteredSequences = useMemo(() => {
    return sequences.filter((seq) => {
      const state = computeSequenceState(seq);

      if (statusFilter === "ACTIVE" && !state.isActive) return false;
      if (statusFilter === "COMPLETED" && !state.isCompleted) return false;
      if (statusFilter === "PAUSED" && !state.isPaused) return false;

      if (search && search.trim()) {
        const q = search.toLowerCase().trim();
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
  }, [sequences, statusFilter, search]);

  if (error) {
    return (
      <div className="min-h-screen p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
        <div className="p-4 bg-destructive/10 text-destructive rounded-xl font-medium flex justify-between items-center" role="alert">
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* 1. Signature Warm Header Banner */}
      <div className="bg-gradient-to-r from-orange-100/70 via-amber-50/60 to-white dark:from-slate-900 dark:via-slate-900 dark:to-slate-800/80 border border-orange-200/80 dark:border-orange-950/40 rounded-2xl p-5 md:p-6 shadow-xs relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start sm:items-center gap-4">
            <div className="h-11 w-11 rounded-full bg-orange-100 dark:bg-orange-950/70 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0 border border-orange-200/80 dark:border-orange-800/50 shadow-xs">
              <Layers className="h-5 w-5" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                  Outreach Sequences
                </h1>
                <TooltipProvider>
                  <Tooltip delayDuration={200}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="flex items-center justify-center h-5 w-5 rounded-full bg-orange-100/80 text-orange-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-orange-200 transition-colors cursor-help"
                      >
                        <Info className="h-3 w-3" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" align="center" className="max-w-xs p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl rounded-xl z-50 text-xs">
                      <p className="font-semibold text-slate-900 dark:text-white mb-1">
                        What is an Outreach Sequence?
                      </p>
                      <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                        An automated chain of emails. The engine handles follow-ups, timezone optimization, and reply detection automatically.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                Active outreach campaigns running for your prospects with smart follow-ups.
              </p>
            </div>
          </div>

          <div className="shrink-0 self-start md:self-center">
            <Button className="gap-2 bg-orange-600 hover:bg-orange-700 text-white shadow-xs rounded-xl" asChild>
              <FastLink href="/prospects">
                <Plus className="h-4 w-4" />
                <span>Create Sequence</span>
              </FastLink>
            </Button>
          </div>
        </div>
      </div>

      {/* 2. Top Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Sequences */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Sequences
            </div>
            <div className="text-xl font-bold text-slate-900 dark:text-white font-mono mt-0.5">
              {stats.total}
            </div>
          </div>
          <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center">
            <Layers className="h-4 w-4" />
          </div>
        </div>

        {/* Active Campaigns */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Active Campaigns
            </div>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-bold text-slate-900 dark:text-white font-mono">
                {stats.active}
              </span>
              <span className="text-[11px] text-emerald-600 font-semibold">running</span>
            </div>
          </div>
          <div className="h-8 w-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <PlayCircle className="h-4 w-4" />
          </div>
        </div>

        {/* Completed */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Completed
            </div>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-bold text-slate-900 dark:text-white font-mono">
                {stats.completed}
              </span>
              <span className="text-[11px] text-indigo-600 font-semibold">finished</span>
            </div>
          </div>
          <div className="h-8 w-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <CheckCircle2 className="h-4 w-4" />
          </div>
        </div>

        {/* Paused */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Paused / Stopped
            </div>
            <div className="text-xl font-bold text-slate-900 dark:text-white font-mono mt-0.5">
              {stats.paused}
            </div>
          </div>
          <div className="h-8 w-8 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <PauseCircle className="h-4 w-4" />
          </div>
        </div>
      </div>

      {/* 3. Toolbar: Search & Segmented Filter Tabs */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            autoComplete="off"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search prospect, company, email, or subject..."
            className="w-full pl-9 pr-8 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all shadow-xs"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Filter Tabs with Live Item Counts */}
        <div className="inline-flex bg-slate-100 dark:bg-slate-900 p-0.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
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
                className={`px-3 py-1.5 rounded-lg font-medium text-[11px] flex items-center gap-1.5 transition-all ${
                  isActive
                    ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs font-semibold"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1 py-0.2 rounded-full ${
                    isActive
                      ? "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold"
                      : "bg-slate-200/60 dark:bg-slate-800 text-slate-400"
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
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-3">
          {Array.from({ length: 5 }).map((_, idx) => (
            <div key={idx} className="h-16 bg-slate-100 dark:bg-slate-800/60 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filteredSequences.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mx-auto mb-3">
            <Inbox className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-1">
            {search ? `No sequences match "${search}"` : "No sequences found in this view"}
          </h3>
          <p className="text-slate-500 dark:text-slate-400 text-xs max-w-sm mx-auto mb-5">
            {search ? "Try adjusting your search query." : "Launch automated sequences for your prospects to get started."}
          </p>
          <Button className="bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs" asChild>
            <FastLink href="/prospects">Create Sequence</FastLink>
          </Button>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/90 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold text-[11px] uppercase tracking-wider">
                <TableRow>
                  <TableHead className="w-[340px] py-3 px-4">Prospect & Sequence</TableHead>
                  <TableHead className="w-[220px] py-3 px-3">Status & Schedule</TableHead>
                  <TableHead className="py-3 px-3">Progress</TableHead>
                  <TableHead className="text-right w-[100px] py-3 px-4">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                <AnimatePresence initial={false}>
                  {filteredSequences.map((seq) => {
                    const state = computeSequenceState(seq);
                    const firstSubject = seq.steps?.[0]?.subject;
                    const avatarStyle = getAvatarColor(seq.prospect?.email || seq.id);

                    // Clean company name (ignore "Unknown", "null", etc.)
                    const cleanCompany =
                      seq.prospect?.company &&
                      seq.prospect.company.toLowerCase() !== "unknown" &&
                      seq.prospect.company.toLowerCase() !== "null"
                        ? seq.prospect.company
                        : null;

                    return (
                      <motion.tr
                        key={seq.id}
                        layout
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        transition={{ duration: 0.15 }}
                        onClick={() => router.push(`/prospects/${seq.prospect.id}/sequence`)}
                        className="group cursor-pointer hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        {/* Prospect & Subject */}
                        <TableCell className="py-3 px-4">
                          <div className="flex items-start gap-3">
                            <div
                              className={`h-9 w-9 rounded-xl font-bold text-xs flex items-center justify-center shrink-0 border mt-0.5 shadow-2xs ${avatarStyle}`}
                            >
                              {seq.prospect?.name
                                ? seq.prospect.name.charAt(0).toUpperCase()
                                : seq.prospect?.email?.charAt(0).toUpperCase() || "P"}
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-sm text-slate-900 dark:text-white group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors truncate max-w-xs">
                                {firstSubject || `Sequence for ${seq.prospect.name}`}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate max-w-xs">
                                to <span className="font-medium text-slate-700 dark:text-slate-300">{seq.prospect.name}</span>
                                {cleanCompany && <span className="text-slate-400"> at {cleanCompany}</span>}
                              </div>
                            </div>
                          </div>
                        </TableCell>

                        {/* Status & Schedule (Accurate & Non-Redundant) */}
                        <TableCell className="py-3 px-3">
                          <div className="flex flex-col items-start gap-1">
                            {state.isCompleted ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-semibold text-[11px] border border-emerald-200/60 dark:border-emerald-900/60 shadow-2xs">
                                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                                <span>Completed</span>
                              </span>
                            ) : state.isPaused ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-semibold text-[11px] border border-amber-200/60 dark:border-amber-900/60 shadow-2xs">
                                <PauseCircle className="h-3 w-3 text-amber-600" />
                                <span>Paused</span>
                              </span>
                            ) : state.isDraft ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium text-[11px] border border-slate-200/60 dark:border-slate-700/60">
                                <span>Draft</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-semibold text-[11px] border border-emerald-200/60 dark:border-emerald-900/60 shadow-2xs">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                <span>Active</span>
                              </span>
                            )}

                            {/* Subtext description */}
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                              {state.isCompleted ? (
                                <span className="text-slate-400">
                                  All {state.totalSteps} {state.totalSteps === 1 ? "step" : "steps"} finished
                                </span>
                              ) : state.nextSendAt && state.isActive ? (
                                <span className="text-slate-700 dark:text-slate-300 font-medium flex items-center gap-1">
                                  <Clock className="h-3 w-3 text-orange-500" />
                                  Next: {formatDistanceToNow(new Date(state.nextSendAt), { addSuffix: true })}
                                </span>
                              ) : state.isPaused ? (
                                <span className="text-slate-400">
                                  {state.sentSteps} of {state.totalSteps} steps sent
                                </span>
                              ) : (
                                <span className="text-slate-400">No pending follow-ups</span>
                              )}
                            </div>
                          </div>
                        </TableCell>

                        {/* Progress Bar */}
                        <TableCell className="py-3 px-3">
                          <div className="flex flex-col gap-1.5 w-full pr-6">
                            <div className="flex justify-between text-[11px] font-medium text-slate-500 dark:text-slate-400">
                              <span>
                                {state.isCompleted
                                  ? `${state.totalSteps} of ${state.totalSteps} steps completed`
                                  : `Step ${state.currentStepNum} of ${state.totalSteps}`}
                              </span>
                              <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">
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
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2 text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 text-xs font-medium"
                              asChild
                            >
                              <FastLink href={`/prospects/${seq.prospect.id}/sequence`}>
                                <span className="hidden sm:inline mr-1">Inspect</span>
                                <ArrowUpRight className="h-3.5 w-3.5" />
                              </FastLink>
                            </Button>

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44 rounded-xl shadow-lg">
                                <DropdownMenuItem asChild>
                                  <FastLink href={`/prospects/${seq.prospect.id}/sequence`} className="cursor-pointer">
                                    <ExternalLink className="mr-2 h-3.5 w-3.5" />
                                    View Details
                                  </FastLink>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() =>
                                    setSequenceToDelete({
                                      id: seq.id,
                                      name: seq.prospect?.name ? `Sequence for ${seq.prospect.name}` : "Sequence",
                                    })
                                  }
                                  className="text-rose-600 focus:bg-rose-50 focus:text-rose-700 cursor-pointer"
                                >
                                  <Trash2 className="mr-2 h-3.5 w-3.5" />
                                  Delete Sequence
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
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
              <span>Engine Status: Active</span>
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
