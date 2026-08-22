"use client";

import React, { useState, useMemo, useEffect, useRef, useDeferredValue } from "react";
import { FastLink } from "@/components/ui/fast-link";
import { useRouter, useSearchParams } from "next/navigation";
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
  ArrowUpRight,
  User,
  Eye,
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
  isOpened?: boolean;
  openCount?: number;
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
  const [statusFilter, setStatusFilter] = useState<"ALL" | "OPENED" | "ACTIVE" | "REPLIED" | "NOT_CONTACTED">("ALL");
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

  const [cachedProspects, setCachedProspects] = useState<any>(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("silaer_cached_prospects");
        if (raw) return JSON.parse(raw);
      } catch {}
    }
    return null;
  });

  const { data, error, isLoading } = useSWR<{
    data: ProspectDetail[];
    pagination?: { total: number };
  }>("/api/prospects?limit=500", fetcher, {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    refreshInterval: 6000,
    dedupingInterval: 2000,
    keepPreviousData: true,
    fallbackData: cachedProspects,
    onSuccess: (resData) => {
      if (resData && typeof window !== "undefined") {
        try {
          localStorage.setItem("silaer_cached_prospects", JSON.stringify(resData));
        } catch {}
      }
    },
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
    let opened = 0;
    let notContacted = 0;

    prospects.forEach((p) => {
      if (p.status === "REPLIED") replied++;
      else if (p.status === "OPENED" || p.isOpened) opened++;
      else if (p.sequence?.status === "ACTIVE") active++;
      else if (!p.isContacted) notContacted++;
    });

    return {
      total: prospects.length,
      active,
      replied,
      opened,
      notContacted,
    };
  }, [prospects]);

  const deferredSearch = useDeferredValue(search);

  // Client-side filtering with 0ms instant response
  const filteredProspects = useMemo(() => {
    return prospects.filter((p) => {
      if (statusFilter === "ACTIVE" && p.sequence?.status !== "ACTIVE") return false;
      if (statusFilter === "OPENED" && p.status !== "OPENED" && !p.isOpened) return false;
      if (statusFilter === "REPLIED" && p.status !== "REPLIED") return false;
      if (statusFilter === "NOT_CONTACTED" && (p.isContacted || p.status === "REPLIED" || p.status === "OPENED" || p.isOpened)) return false;

      if (deferredSearch && deferredSearch.trim()) {
        const q = deferredSearch.toLowerCase().trim();
        const matchName = p.name?.toLowerCase().includes(q);
        const matchEmail = p.email?.toLowerCase().includes(q);
        const matchCompany = p.company?.toLowerCase().includes(q);
        if (!matchName && !matchEmail && !matchCompany) {
          return false;
        }
      }

      return true;
    });
  }, [prospects, statusFilter, deferredSearch]);

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
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* 1. Dynamic Silaer Signature Header */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-xs relative overflow-hidden transition-colors duration-200">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5 relative z-10">
          <div className="flex items-start sm:items-center gap-4">
            <div className="h-11 w-11 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
              <Users className="h-5 w-5" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-bold text-foreground tracking-tight">
                  Prospect Directory
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
                        Prospect Directory
                      </p>
                      <p className="text-muted-foreground leading-relaxed">
                        Manage your outreach contacts, track live email lifecycle status, and launch targeted sequences.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="text-xs md:text-sm text-muted-foreground mt-1">
                Manage your prospects, monitor real-time email engagement, and scale outreach campaigns.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 self-start md:self-center">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              className="gap-2 text-xs h-9 px-3.5"
            >
              <Download className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="hidden sm:inline">Export CSV</span>
            </Button>

            <Button size="sm" className="gap-2 text-xs h-9 px-4" asChild>
              <FastLink href="/prospects/new">
                <Plus className="h-4 w-4 stroke-[2.5]" />
                <span>Add Prospect</span>
              </FastLink>
            </Button>
          </div>
        </div>
      </div>

      {/* 2. Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Total Prospects */}
        <div className="bg-card border border-border rounded-xl p-4 sm:p-5 shadow-xs hover:border-border transition-all duration-150 flex items-center justify-between group">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Total Prospects
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-foreground font-mono mt-1 tracking-tight">
              {stats.total}
            </div>
          </div>
          <div className="h-9 w-9 rounded-lg bg-secondary text-foreground flex items-center justify-center border border-border">
            <Users className="h-4 w-4 text-primary" />
          </div>
        </div>

        {/* In Active Sequences */}
        <div className="bg-card border border-border rounded-xl p-4 sm:p-5 shadow-xs hover:border-border transition-all duration-150 flex items-center justify-between group">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Active Outreach
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl sm:text-3xl font-extrabold text-foreground font-mono tracking-tight">
                {stats.active}
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                in sequence
              </span>
            </div>
          </div>
          <div className="h-9 w-9 rounded-lg bg-secondary text-foreground flex items-center justify-center border border-border">
            <PlayCircle className="h-4 w-4 text-emerald-500" />
          </div>
        </div>

        {/* Replied */}
        <div className="bg-card border border-border rounded-xl p-4 sm:p-5 shadow-xs hover:border-border transition-all duration-150 flex items-center justify-between group">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Replied
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl sm:text-3xl font-extrabold text-foreground font-mono tracking-tight">
                {stats.replied}
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md border border-blue-500/20">
                engaged
              </span>
            </div>
          </div>
          <div className="h-9 w-9 rounded-lg bg-secondary text-foreground flex items-center justify-center border border-border">
            <MessageSquareReply className="h-4 w-4 text-blue-500" />
          </div>
        </div>

        {/* Ready to Outreach */}
        <div className="bg-card border border-border rounded-xl p-4 sm:p-5 shadow-xs hover:border-border transition-all duration-150 flex items-center justify-between group">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Ready to Outreach
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-foreground font-mono mt-1 tracking-tight">
              {stats.notContacted}
            </div>
          </div>
          <div className="h-9 w-9 rounded-lg bg-secondary text-foreground flex items-center justify-center border border-border">
            <Send className="h-4 w-4 text-amber-500" />
          </div>
        </div>
      </div>

      {/* 3. Toolbar: Search & Segmented Filter Tabs */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            autoComplete="off"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, or company... (Press / to search)"
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

        {/* Filter Tabs with Live Item Counts */}
        <div className="inline-flex bg-secondary p-1 rounded-lg border border-border shadow-2xs text-xs gap-1">
          {[
            { key: "ALL", label: "All", count: stats.total },
            { key: "OPENED", label: "Opened", count: stats.opened },
            { key: "ACTIVE", label: "Active", count: stats.active },
            { key: "REPLIED", label: "Replied", count: stats.replied },
            { key: "NOT_CONTACTED", label: "Not Contacted", count: stats.notContacted },
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

      {/* 4. Table */}
      {isLoading && prospects.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-4 shadow-xs space-y-3">
          {Array.from({ length: 5 }).map((_, idx) => (
            <div key={idx} className="h-14 bg-secondary/60 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : filteredProspects.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-xl border border-border shadow-xs">
          <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground mx-auto mb-3 border border-border">
            <Users className="h-5 w-5" />
          </div>
          <h3 className="text-sm font-semibold text-foreground mb-1">
            {search ? `No prospects match "${search}"` : "No prospects in queue"}
          </h3>
          <p className="text-muted-foreground text-xs max-w-sm mx-auto mb-5">
            {search ? "Try adjusting your search query." : "Add contacts manually or import a CSV file to launch outreach."}
          </p>
          <Button size="sm" className="text-xs" asChild>
            <FastLink href="/prospects/new">Add Your First Prospect</FastLink>
          </Button>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-secondary/50 border-b border-border text-muted-foreground font-semibold text-[11px] uppercase tracking-wider sticky top-0 z-10">
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="w-[320px] py-3 px-4 text-muted-foreground">Prospect</TableHead>
                  <TableHead className="w-[200px] py-3 px-3 text-muted-foreground">Company</TableHead>
                  <TableHead className="w-[150px] py-3 px-3 text-muted-foreground">Status</TableHead>
                  <TableHead className="w-[160px] py-3 px-3 text-muted-foreground">Sequence</TableHead>
                  <TableHead className="w-[180px] py-3 px-3 text-muted-foreground">Last Activity</TableHead>
                  <TableHead className="text-right w-[80px] py-3 px-4 text-muted-foreground">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-border">
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
                    const allStepsSent = Boolean(prospect.sequence.steps && prospect.sequence.steps.length > 0 && prospect.sequence.steps.every((s) => s.status === "SENT"));
                    if (prospect.status === "REPLIED" || prospect.sequence.status === "STOPPED") {
                      sequenceBadge = (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary text-muted-foreground font-semibold text-[10px] border border-border">
                          Stopped
                        </span>
                      );
                    } else if (prospect.sequence.status === "COMPLETED" || allStepsSent) {
                      sequenceBadge = (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-700 dark:text-blue-300 font-semibold text-[10px] border border-blue-500/20">
                          Completed
                        </span>
                      );
                    } else if (prospect.sequence.status === "ACTIVE") {
                      sequenceBadge = (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold text-[10px] border border-emerald-500/20">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Active
                        </span>
                      );
                    } else if (prospect.sequence.status === "PAUSED") {
                      sequenceBadge = (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-300 font-semibold text-[10px] border border-amber-500/20">
                          Paused
                        </span>
                      );
                    } else {
                      sequenceBadge = (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary text-muted-foreground font-medium text-[10px]">
                          {prospect.sequence.status}
                        </span>
                      );
                    }
                  } else {
                    sequenceBadge = (
                      <span className="text-[11px] text-muted-foreground font-mono">None</span>
                    );
                  }

                  const lastActivity = prospect.lastActivityAt || prospect.created_at;

                  return (
                    <TableRow
                      key={prospect.id}
                      onClick={() => router.push(`/prospects/${prospect.id}`)}
                      className="group cursor-pointer hover:bg-secondary/60 transition-colors"
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
                            <div className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors truncate max-w-xs">
                              <HighlightMatch text={prospect.name} query={search} />
                            </div>
                            <div className="text-xs text-muted-foreground truncate max-w-xs">
                              <HighlightMatch text={prospect.email} query={search} />
                            </div>
                          </div>
                        </div>
                      </TableCell>

                      {/* Company */}
                      <TableCell className="py-3 px-3 text-xs text-muted-foreground">
                        <HighlightMatch text={cleanCompany} query={search} />
                      </TableCell>

                      {/* Status */}
                      <TableCell className="py-3 px-3">
                        {prospect.status === "REPLIED" ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-semibold text-[10px] border border-indigo-500/20">
                            <MessageSquareReply className="h-3 w-3 text-indigo-600" />
                            Replied
                          </span>
                        ) : (prospect.status === "OPENED" || prospect.isOpened) ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-700 dark:text-sky-300 font-semibold text-[10px] border border-sky-500/20">
                            <Eye className="h-3 w-3 text-sky-600" />
                            Opened{prospect.openCount && prospect.openCount > 1 ? ` (${prospect.openCount})` : ""}
                          </span>
                        ) : prospect.sequence?.status === "ACTIVE" ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold text-[10px] border border-emerald-500/20">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Active
                          </span>
                        ) : (prospect.isContacted || prospect.sequence?.status === "COMPLETED" || prospect.status === "COMPLETED") ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-700 dark:text-blue-300 font-semibold text-[10px] border border-blue-500/20">
                            <Send className="h-2.5 w-2.5 text-blue-600" />
                            Sent
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary text-muted-foreground font-medium text-[10px] border border-border">
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
                            <span className="text-xs font-medium text-foreground">
                              {format(new Date(lastActivity), "MMM d, yyyy")}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {formatDistanceToNow(new Date(lastActivity), { addSuffix: true })}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Never</span>
                        )}
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-muted-foreground hover:text-foreground text-xs font-medium"
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
                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44 rounded-xl shadow-lg border border-border bg-popover">
                              <DropdownMenuItem asChild>
                                <FastLink href={`/prospects/${prospect.id}`} className="cursor-pointer">
                                  <User className="mr-2 h-3.5 w-3.5" />
                                  View Profile
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
                                className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer"
                              >
                                <Trash className="mr-2 h-3.5 w-3.5" />
                                Delete Prospect
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
