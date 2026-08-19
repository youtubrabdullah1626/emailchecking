"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { FastLink } from "@/components/ui/fast-link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { format, formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Search,
  Plus,
  Filter,
  Check,
  MoreHorizontal,
  Trash,
  ExternalLink,
  Info,
  Sparkles,
  AlertTriangle,
  Users,
  Download,
  X,
  Send,
  MessageSquareReply,
  PlayCircle,
  Clock,
  ArrowUpRight,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import useSWR, { mutate } from "swr";
import { toast } from "sonner";
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

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Error ${res.status}`);
  }
  return res.json();
};

interface ProspectDetail {
  id: string;
  name: string;
  email: string;
  company: string;
  status: string;
  created_at: string;
  lastActivityAt: string | null;
  source?: string;
  isContacted?: boolean;
  campaign?: {
    id: string;
    name: string;
  } | null;
  sequence: {
    status: string;
    steps: {
      id: string;
      step_number: number;
      status: string;
    }[];
  } | null;
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

function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query.trim() || !text) return <>{text}</>;
  const parts = text.split(new RegExp(`(${query})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <span
            key={i}
            className="bg-amber-200/80 dark:bg-amber-500/30 text-amber-950 dark:text-amber-200 font-bold px-0.5 rounded"
          >
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}

function ProspectsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "REPLIED" | "NOT_CONTACTED">("ALL");
  const [prospectToDelete, setProspectToDelete] = useState<{ id: string; name: string } | null>(null);

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

  const { data, error, isLoading } = useSWR<{
    data: ProspectDetail[];
    pagination?: { total: number };
  }>("/api/prospects?limit=500", fetcher, {
    revalidateOnFocus: true,
    dedupingInterval: 5000,
  });

  const prospects = useMemo(() => {
    const list = [...(data?.data || [])];
    list.sort((a, b) => {
      const timeA = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : new Date(a.created_at).getTime();
      const timeB = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : new Date(b.created_at).getTime();
      return timeB - timeA;
    });
    return list;
  }, [data?.data]);

  // Summary Metrics
  const stats = useMemo(() => {
    let active = 0;
    let replied = 0;
    let notContacted = 0;

    prospects.forEach((p) => {
      if (p.status === "REPLIED") replied++;
      else if (p.sequence?.status === "ACTIVE") active++;
      else if (!p.sequence || p.status === "ACTIVE") notContacted++;
    });

    return {
      total: prospects.length,
      active,
      replied,
      notContacted,
    };
  }, [prospects]);

  // Client-side filtering with 0ms instant response
  const filteredProspects = useMemo(() => {
    return prospects.filter((p) => {
      if (statusFilter === "ACTIVE" && p.sequence?.status !== "ACTIVE") return false;
      if (statusFilter === "REPLIED" && p.status !== "REPLIED") return false;
      if (statusFilter === "NOT_CONTACTED" && (p.sequence || p.status === "REPLIED")) return false;

      if (search && search.trim()) {
        const q = search.toLowerCase().trim();
        const matchName = p.name?.toLowerCase().includes(q);
        const matchEmail = p.email?.toLowerCase().includes(q);
        const matchCompany = p.company?.toLowerCase().includes(q);
        if (!matchName && !matchEmail && !matchCompany) {
          return false;
        }
      }

      return true;
    });
  }, [prospects, statusFilter, search]);

  // Export to CSV
  const handleExportCSV = () => {
    if (filteredProspects.length === 0) {
      toast.info("No prospects to export");
      return;
    }

    const headers = ["Name", "Email", "Company", "Status", "Sequence Status", "Last Activity"];
    const rows = filteredProspects.map((p) => [
      `"${(p.name || "").replace(/"/g, '""')}"`,
      `"${(p.email || "").replace(/"/g, '""')}"`,
      `"${(p.company || "").replace(/"/g, '""')}"`,
      `"${p.status}"`,
      `"${p.sequence?.status || "None"}"`,
      `"${p.lastActivityAt || p.created_at}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `prospects_export_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${filteredProspects.length} prospects to CSV`);
  };

  const confirmDeleteProspect = async () => {
    if (!prospectToDelete) return;
    const { id, name } = prospectToDelete;
    setProspectToDelete(null);

    // Optimistic delete
    mutate(
      "/api/prospects?limit=500",
      {
        ...data,
        data: prospects.filter((p) => p.id !== id),
      },
      false
    );

    try {
      const res = await fetch(`/api/prospects/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete prospect");
      toast.success(`Prospect "${name}" deleted`);
      mutate("/api/prospects?limit=500");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete prospect");
      mutate("/api/prospects?limit=500");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* 1. Dynamic Silaer Signature Header */}
      <div className="bg-gradient-to-r from-primary/15 via-primary/5 to-card border border-primary/20 rounded-2xl p-5 md:p-6 shadow-xs relative overflow-hidden transition-colors duration-300">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start sm:items-center gap-4">
            <div className="h-11 w-11 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0 border border-primary/25 shadow-xs">
              <Users className="h-5 w-5" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                  Prospect Directory
                </h1>
                <TooltipProvider>
                  <Tooltip delayDuration={200}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="flex items-center justify-center h-5 w-5 rounded-full bg-primary/15 text-primary hover:bg-primary/25 transition-colors cursor-help"
                      >
                        <Info className="h-3 w-3" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" align="center" className="max-w-xs p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl rounded-xl z-50 text-xs">
                      <p className="font-semibold text-slate-900 dark:text-white mb-1">
                        Prospect Lead Dossier
                      </p>
                      <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                        Manage your outreach contacts, track email lifecycle status, and launch sequences.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                Manage your prospects, track active engagement, and launch outreach campaigns.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-start md:self-center">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              className="gap-1.5 rounded-xl border border-border bg-card/80 text-foreground shadow-2xs hover:bg-primary/10"
            >
              <Download className="h-3.5 w-3.5 text-primary" />
              <span className="hidden sm:inline text-xs font-medium">Export CSV</span>
            </Button>

            <Button className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs rounded-xl font-semibold" asChild>
              <FastLink href="/prospects/new">
                <Plus className="h-4 w-4" />
                <span>Add Prospect</span>
              </FastLink>
            </Button>
          </div>
        </div>
      </div>

      {/* 2. Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Prospects */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Prospects
            </div>
            <div className="text-xl font-bold text-slate-900 dark:text-white font-mono mt-0.5">
              {stats.total}
            </div>
          </div>
          <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center">
            <Users className="h-4 w-4" />
          </div>
        </div>

        {/* In Active Sequences */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Active Outreach
            </div>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-bold text-slate-900 dark:text-white font-mono">
                {stats.active}
              </span>
              <span className="text-[11px] text-emerald-600 font-semibold">in sequence</span>
            </div>
          </div>
          <div className="h-8 w-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <PlayCircle className="h-4 w-4" />
          </div>
        </div>

        {/* Replied */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Replied
            </div>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-bold text-slate-900 dark:text-white font-mono">
                {stats.replied}
              </span>
              <span className="text-[11px] text-indigo-600 font-semibold">engaged</span>
            </div>
          </div>
          <div className="h-8 w-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <MessageSquareReply className="h-4 w-4" />
          </div>
        </div>

        {/* Not Contacted */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Ready to Outreach
            </div>
            <div className="text-xl font-bold text-slate-900 dark:text-white font-mono mt-0.5">
              {stats.notContacted}
            </div>
          </div>
          <div className="h-8 w-8 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <Send className="h-4 w-4" />
          </div>
        </div>
      </div>

      {/* 3. Toolbar: Search & Segmented Filter Tabs */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            autoComplete="off"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, or company... (Press / to search)"
            className="w-full pl-9 pr-12 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all shadow-xs"
          />
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {search ? (
              <button
                onClick={() => setSearch("")}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : (
              <kbd className="hidden sm:inline-block text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700">
                /
              </kbd>
            )}
          </div>
        </div>

        {/* Filter Tabs with Live Item Counts */}
        <div className="inline-flex bg-slate-100 dark:bg-slate-900 p-0.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
          {[
            { key: "ALL", label: "All", count: stats.total },
            { key: "ACTIVE", label: "Active", count: stats.active },
            { key: "REPLIED", label: "Replied", count: stats.replied },
            { key: "NOT_CONTACTED", label: "Not Contacted", count: stats.notContacted },
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

      {/* 4. Table */}
      {isLoading && prospects.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-3">
          {Array.from({ length: 5 }).map((_, idx) => (
            <div key={idx} className="h-16 bg-slate-100 dark:bg-slate-800/60 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filteredProspects.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mx-auto mb-3">
            <Users className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-1">
            {search ? `No prospects match "${search}"` : "No prospects found in this view"}
          </h3>
          <p className="text-slate-500 dark:text-slate-400 text-xs max-w-sm mx-auto mb-5">
            {search ? "Try adjusting your search query." : "Add contacts manually or import a CSV file to launch outreach."}
          </p>
          <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl text-xs" asChild>
            <FastLink href="/prospects/new">Add Your First Prospect</FastLink>
          </Button>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/90 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold text-[11px] uppercase tracking-wider sticky top-0 z-10 backdrop-blur-xs">
                <TableRow>
                  <TableHead className="w-[320px] py-3 px-4">Prospect</TableHead>
                  <TableHead className="w-[200px] py-3 px-3">Company</TableHead>
                  <TableHead className="w-[150px] py-3 px-3">Status</TableHead>
                  <TableHead className="w-[160px] py-3 px-3">Sequence</TableHead>
                  <TableHead className="w-[180px] py-3 px-3">Last Activity</TableHead>
                  <TableHead className="text-right w-[80px] py-3 px-4">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                <AnimatePresence initial={false}>
                  {filteredProspects.map((prospect) => {
                    const avatarStyle = getAvatarColor(prospect.email || prospect.id);
                    const cleanCompany =
                      prospect.company &&
                      prospect.company.toLowerCase() !== "unknown" &&
                      prospect.company.toLowerCase() !== "null"
                        ? prospect.company
                        : "—";

                    let sequenceBadge = null;
                    if (prospect.sequence) {
                      if (prospect.status === "REPLIED" || prospect.sequence.status === "STOPPED") {
                        sequenceBadge = (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold text-[10px] border border-slate-200/60">
                            Stopped
                          </span>
                        );
                      } else if (prospect.sequence.status === "ACTIVE") {
                        sequenceBadge = (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-semibold text-[10px] border border-emerald-200/60">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Active
                          </span>
                        );
                      } else if (prospect.sequence.status === "COMPLETED") {
                        sequenceBadge = (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold text-[10px] border border-indigo-200/60">
                            Completed
                          </span>
                        );
                      } else if (prospect.sequence.status === "PAUSED") {
                        sequenceBadge = (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-semibold text-[10px] border border-amber-200/60">
                            Paused
                          </span>
                        );
                      } else {
                        sequenceBadge = (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium text-[10px]">
                            {prospect.sequence.status}
                          </span>
                        );
                      }
                    } else {
                      sequenceBadge = (
                        <span className="text-[11px] text-slate-400 font-medium">None</span>
                      );
                    }

                    const lastActivity = prospect.lastActivityAt || prospect.created_at;

                    return (
                      <motion.tr
                        key={prospect.id}
                        layout
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        transition={{ duration: 0.15 }}
                        onClick={() => router.push(`/prospects/${prospect.id}`)}
                        className="group cursor-pointer hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        {/* Prospect Name & Email */}
                        <TableCell className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={`h-9 w-9 rounded-xl font-bold text-xs flex items-center justify-center shrink-0 border shadow-2xs ${avatarStyle}`}
                            >
                              {prospect.name
                                .split(" ")
                                .map((n) => n[0])
                                .join("")
                                .substring(0, 2)
                                .toUpperCase() || "P"}
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-sm text-slate-900 dark:text-white group-hover:text-primary transition-colors truncate max-w-xs">
                                <HighlightMatch text={prospect.name} query={search} />
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-xs">
                                <HighlightMatch text={prospect.email} query={search} />
                              </div>
                            </div>
                          </div>
                        </TableCell>

                        {/* Company */}
                        <TableCell className="py-3 px-3 text-xs text-slate-600 dark:text-slate-300">
                          <HighlightMatch text={cleanCompany} query={search} />
                        </TableCell>

                        {/* Status */}
                        <TableCell className="py-3 px-3">
                          {prospect.status === "REPLIED" ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold text-[10px] border border-indigo-200/60">
                              <MessageSquareReply className="h-3 w-3 text-indigo-600" />
                              Replied
                            </span>
                          ) : prospect.sequence?.status === "ACTIVE" ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-semibold text-[10px] border border-emerald-200/60">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              Active
                            </span>
                          ) : (prospect.isContacted || prospect.sequence?.status === "COMPLETED" || prospect.status === "COMPLETED") ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold text-[10px] border border-blue-200/60">
                              <Send className="h-2.5 w-2.5 text-blue-600" />
                              Contacted
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium text-[10px]">
                              Not Started
                            </span>
                          )}
                        </TableCell>

                        {/* Sequence */}
                        <TableCell className="py-3 px-3">
                          {sequenceBadge}
                        </TableCell>

                        {/* Last Activity */}
                        <TableCell className="py-3 px-3">
                          {lastActivity ? (
                            <div className="flex flex-col">
                              <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
                                {format(new Date(lastActivity), "MMM d, yyyy")}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {formatDistanceToNow(new Date(lastActivity), { addSuffix: true })}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">Never</span>
                          )}
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
                              <FastLink href={`/prospects/${prospect.id}`}>
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
                                  <FastLink href={`/prospects/${prospect.id}`} className="cursor-pointer">
                                    <ExternalLink className="mr-2 h-3.5 w-3.5" />
                                    View Dossier
                                  </FastLink>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                  <FastLink href={`/prospects/${prospect.id}/sequence`} className="cursor-pointer">
                                    <PlayCircle className="mr-2 h-3.5 w-3.5" />
                                    Manage Sequence
                                  </FastLink>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() =>
                                    setProspectToDelete({
                                      id: prospect.id,
                                      name: prospect.name || "Prospect",
                                    })
                                  }
                                  className="text-rose-600 focus:bg-rose-50 focus:text-rose-700 cursor-pointer"
                                >
                                  <Trash className="mr-2 h-3.5 w-3.5" />
                                  Delete Prospect
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
              Showing <strong className="text-slate-700 dark:text-slate-200">{filteredProspects.length}</strong> of {prospects.length} prospects
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span>Prospect Directory Synced</span>
            </span>
          </div>
        </div>
      )}

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog
        open={!!prospectToDelete}
        onOpenChange={(open) => !open && setProspectToDelete(null)}
      >
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader className="sm:flex-row sm:items-start gap-4 space-y-0 text-left">
            <div className="mx-auto sm:mx-0 h-12 w-12 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-6 w-6 stroke-[2.2]" />
            </div>
            <div className="space-y-1.5 flex-1 text-center sm:text-left">
              <AlertDialogTitle className="text-lg font-bold text-slate-900 dark:text-white">
                Delete Prospect
              </AlertDialogTitle>
              <AlertDialogDescription className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                Are you sure you want to delete <span className="font-semibold text-slate-800 dark:text-slate-200">{prospectToDelete?.name}</span>? All their sequence history, activity logs, and email records will be removed.
              </AlertDialogDescription>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-2 sm:mt-0 gap-2">
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteProspect}
              className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl"
            >
              Delete Prospect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

import { Suspense } from "react";

export default function ProspectsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-slate-400">Loading Prospects...</div>}>
      <ProspectsPageContent />
    </Suspense>
  );
}
