"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useImport } from "@/components/providers/ImportProvider";
import { StorageEngine, ImportSessionMetadata } from "@/lib/storage/StorageEngine";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  History, 
  Play, 
  Pause,
  Trash2, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Eye, 
  Plus, 
  MoreVertical, 
  Edit2, 
  Info, 
  Users, 
  Calendar, 
  FileText,
  Search,
  ExternalLink,
  ChevronRight,
  Sparkles,
  ArrowRight,
  FolderOpen,
  Share2
} from "lucide-react";
import { ShareReportModal } from "@/components/reports/ShareReportModal";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDistanceToNow, format } from "date-fns";
import { Input } from "@/components/ui/input";
import useSWR, { useSWRConfig } from "swr";
import { apiClient } from "@/lib/api-client";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export function ImportHistoryWorkspace() {
  const [sessions, setSessions] = useState<ImportSessionMetadata[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const { sessionId, handleFileUpload, setAppendTargetSessionId, openCampaignDashboard } = useImport() as any;

  const storage = useMemo(() => new StorageEngine(), []);

  // Details Modal State
  const [activeDetailsSession, setActiveDetailsSession] = useState<ImportSessionMetadata | null>(null);
  const [activeDataset, setActiveDataset] = useState<any | null>(null);
  const [isLoadingDataset, setIsLoadingDataset] = useState(false);

  // Clear History Modal & State
  const { mutate } = useSWRConfig();
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [selectedTimeframe, setSelectedTimeframe] = useState<"24h" | "7d" | "30d" | "all">("all");
  const [isClearing, setIsClearing] = useState(false);

  // ── Feature Flag: Campaign Pause/Resume ──────────────────────────────────
  // Instant 0ms cache from localStorage + live background sync via /api/feature-flags
  const [cachedFlag, setCachedFlag] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const v = localStorage.getItem("silaer_flag_campaign_pause_resume");
      if (v !== null) return v === "true";
    }
    return true;
  });

  const { data: featureFlags } = useSWR(
    "/api/feature-flags?keys=campaign_pause_resume",
    (url: string) => fetch(url).then(r => r.json()),
    {
      revalidateOnFocus: true,
      refreshInterval: 5000, // Sync every 5s
      dedupingInterval: 2000,
    }
  );

  const pauseResumeEnabled = featureFlags && typeof featureFlags["campaign_pause_resume"] === "boolean"
    ? featureFlags["campaign_pause_resume"]
    : cachedFlag;

  useEffect(() => {
    if (featureFlags && typeof featureFlags["campaign_pause_resume"] === "boolean") {
      const val = featureFlags["campaign_pause_resume"];
      setCachedFlag(val);
      if (typeof window !== "undefined") {
        localStorage.setItem("silaer_flag_campaign_pause_resume", String(val));
      }
    }
  }, [featureFlags]);





  const [shareModalSession, setShareModalSession] = useState<{ id: string; name: string } | null>(null);

  const loadSessions = useCallback(async () => {
    let all = storage.getAllSessions();
    const validSessions: ImportSessionMetadata[] = [];
    
    for (const session of all) {
      // Purge any unlaunched drafts/abandoned sessions so history only contains real launched/completed campaigns
      if (session.lastCheckpoint !== "EXECUTION_STARTED" && session.lastCheckpoint !== "COMPLETED" && session.status !== "COMPLETED") {
        storage.deleteSession(session.sessionId).catch(() => {});
        continue;
      }

      // Auto-update COMPLETED status for LIVE CAMPAIGNS that have no pending items
      if (session.lastCheckpoint === "EXECUTION_STARTED") {
         try {
            const dataset = await storage.loadHeavyDataset(session.sessionId);
            const q = dataset?.executionQueue || [];
            if (q.length > 0) {
               const hasPending = q.some((item: any) => !item.liveStatus || item.liveStatus === "SCHEDULED" || item.liveStatus === "PROCESSING");
               if (!hasPending) {
                  session.status = "COMPLETED";
                  session.lastCheckpoint = "COMPLETED" as any;
                  storage.saveSessionMetadata(session);
               }
            }
         } catch (e) {
           console.error("Failed to load queue for completion check", e);
         }
      }
      validSessions.push(session);
    }
    
    // Sort newest first
    validSessions.sort((a, b) => new Date(b.importDate).getTime() - new Date(a.importDate).getTime());
    setSessions([...validSessions]);
  }, [storage]);

  useEffect(() => {
    loadSessions();
    const interval = setInterval(loadSessions, 3000);
    return () => clearInterval(interval);
  }, [sessionId, loadSessions]);

  // AUTO-RESUME: When feature is disabled, silently resume all PAUSED sessions
  const autoResumedSessionsRef = React.useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!pauseResumeEnabled && sessions.length > 0) {
      sessions.forEach(session => {
        const isPaused = session.status === "PAUSED" || (session.lastCheckpoint as string) === "PAUSED";
        if (isPaused && !autoResumedSessionsRef.current.has(session.sessionId)) {
          autoResumedSessionsRef.current.add(session.sessionId);
          handleAutoResume(session);
        }
      });
    }
    if (pauseResumeEnabled) autoResumedSessionsRef.current.clear();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pauseResumeEnabled, sessions]);



  // Track hidden sessions (optimistic delete) and timers
  const [hiddenSessions, setHiddenSessions] = useState<Set<string>>(new Set());
  const [sessionToDelete, setSessionToDelete] = useState<{ id: string; name: string } | null>(null);
  const deleteTimers = React.useRef<Record<string, NodeJS.Timeout>>({});

  // Opens the Live Execution Dashboard for this campaign instantly (0ms in-memory switch)
  const handleOpenDashboard = async (id: string) => {
    if (openCampaignDashboard) {
      await openCampaignDashboard(id);
    } else {
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.setItem("smart_import_active_session_id", id);
      }
      window.location.reload();
    }
  };


  // Auto-resumes a PAUSED campaign silently (used when pause/resume feature is disabled)
  const handleAutoResume = async (session: ImportSessionMetadata) => {
    try {
      const dataset = await storage.loadHeavyDataset(session.sessionId).catch(() => null);
      const targetId = dataset?.campaignId || session.sessionId;
      await fetch(`/api/campaigns/${encodeURIComponent(targetId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "RESUME", campaignName: session.campaignName }),
      });
      // Update local session status so UI reflects LIVE immediately
      session.status = "EXECUTING";
      session.lastCheckpoint = "EXECUTION_STARTED";
      storage.saveSessionMetadata(session);
      setSessions(prev => [...prev]);
    } catch { /* silent — scheduler will pick up on next tick */ }
  };



  const handleOpenDetails = async (session: ImportSessionMetadata) => {
    setActiveDetailsSession(session);
    setIsLoadingDataset(true);
    try {
      const dataset = await storage.loadHeavyDataset(session.sessionId);
      setActiveDataset(dataset);
    } catch (err) {
      console.error("Failed to load details dataset", err);
      setActiveDataset(null);
    } finally {
      setIsLoadingDataset(false);
    }
  };

  const confirmDeleteSession = async () => {
    if (!sessionToDelete) return;
    const { id, name } = sessionToDelete;
    setSessionToDelete(null);

    const deletePromise = (async () => {
      // 1. INSTANT SYNCHRONOUS UI CLEARING:
      storage.deleteSessionSync(id);
      setSessions(prev => prev.filter(s => s.sessionId !== id));
      setHiddenSessions(prev => new Set(prev).add(id));

      // 2. AWAIT DB DELETION:
      // We must wait for this to finish before resolving the promise.
      // If we don't, the user can re-import immediately and the Duplicate Detection 
      // will see the ghost DB rows before they are deleted.
      const dataset = await storage.loadHeavyDataset(id).catch(() => null);
      const targetCampaignId = dataset?.campaignId || id;

      if (typeof window !== "undefined") {
        if (sessionStorage.getItem("smart_import_active_session_id") === id) {
          sessionStorage.removeItem("smart_import_active_session_id");
        }
        // Cleanup the dynamically scoped caches so localStorage doesn't bloat forever
        localStorage.removeItem(`silaer_cache_items_${targetCampaignId}`);
        localStorage.removeItem(`silaer_cache_status_${targetCampaignId}`);
        localStorage.removeItem(`silaer_cache_stats_${targetCampaignId}`);
        localStorage.removeItem("silaer_active_campaign_id");
      }

      if (targetCampaignId) {
        await fetch(`/api/campaigns/${targetCampaignId}`, { method: "DELETE" }).catch(() => {});
      }

      await storage.deleteSession(id).catch(() => {});
      await mutate("/api/campaigns", undefined, { revalidate: true });
      await mutate("/api/dashboard/stats", undefined, { revalidate: true });
    })();

    toast.promise(deletePromise, {
      loading: 'Deleting campaign and clearing data...',
      success: `Campaign "${name}" deleted.`,
      error: 'Failed to fully delete campaign'
    });

  };



  const handleClearHistory = async (timeframe: "24h" | "7d" | "30d" | "all") => {
    setIsClearing(true);
    const labelMap = {
      "24h": "past 24 hours",
      "7d": "past 7 days",
      "30d": "past 30 days",
      "all": "all-time"
    };

    try {
      const res = await fetch("/api/campaigns/clear-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timeframe })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to clear history");
      }

      // Compute local cutoff
      let cutoffDate: Date | undefined;
      const now = Date.now();
      if (timeframe === "24h") cutoffDate = new Date(now - 24 * 60 * 60 * 1000);
      else if (timeframe === "7d") cutoffDate = new Date(now - 7 * 24 * 60 * 60 * 1000);
      else if (timeframe === "30d") cutoffDate = new Date(now - 30 * 24 * 60 * 60 * 1000);

      await storage.clearAllSessions(cutoffDate);
      await loadSessions();
      await mutate("/api/campaigns", undefined, { revalidate: true });
      await mutate("/api/dashboard/stats", undefined, { revalidate: true });

      toast.success(`Cleared ${labelMap[timeframe]} campaign data`, {
        description: "Database records and local session caches have been wiped."
      });
      setClearDialogOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to clear data");
    } finally {
      setIsClearing(false);
    }
  };

  const handleRename = (id: string, currentName: string) => {
    const newName = window.prompt("Enter new campaign name:", currentName || "Draft Campaign");
    if (newName && newName.trim() !== "") {
      const allSessions = storage.getAllSessions();
      const session = allSessions.find(s => s.sessionId === id);
      if (session) {
        session.campaignName = newName.trim();
        storage.saveSessionMetadata(session);
        loadSessions();
        toast.success("Campaign renamed successfully");
      }
    }
  };

  const handleTogglePause = async (session: ImportSessionMetadata) => {
    // If pause/resume is disabled via platform config, do nothing
    if (!pauseResumeEnabled) return;

    const isCurrentlyPaused = session.status === "PAUSED" || (session.lastCheckpoint as string) === "PAUSED";
    const nextAction = isCurrentlyPaused ? "RESUME" : "PAUSE";

    
    // 1. Instant Optimistic UI Update (0ms latency!)
    const prevStatus = session.status;
    const prevCheckpoint = session.lastCheckpoint;
    session.status = isCurrentlyPaused ? "EXECUTING" : "PAUSED";
    session.lastCheckpoint = isCurrentlyPaused ? "EXECUTION_STARTED" : ("PAUSED" as any);
    storage.saveSessionMetadata(session);
    setSessions(prev => [...prev]);
    toast.success(isCurrentlyPaused ? "Campaign resumed" : "Campaign paused");

    // 2. Background Server Sync
    try {
      let targetId = session.sessionId;
      try {
        const dataset = await storage.loadHeavyDataset(session.sessionId);
        if (dataset?.campaignId) targetId = dataset.campaignId;
      } catch (e) {}

      const res = await fetch(`/api/campaigns/${encodeURIComponent(targetId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          action: nextAction,
          campaignName: session.campaignName 
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        session.status = prevStatus;
        session.lastCheckpoint = prevCheckpoint;
        storage.saveSessionMetadata(session);
        loadSessions();
        toast.error(data.error || `Failed to ${nextAction.toLowerCase()} campaign`);
        return;
      }
      loadSessions();
    } catch (err) {
      session.status = prevStatus;
      session.lastCheckpoint = prevCheckpoint;
      storage.saveSessionMetadata(session);
      loadSessions();
      toast.error("Failed to update campaign state");
    }
  };

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [targetAppendId, setTargetAppendId] = useState<string | null>(null);

  const handleAppendClick = (id: string) => {
    setTargetAppendId(id);
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const onFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && targetAppendId) {
      if (typeof window !== "undefined") {
         window.scrollTo({ top: 0, behavior: "smooth" });
      }
      if (setAppendTargetSessionId) {
        setAppendTargetSessionId(targetAppendId);
      }
      await handleFileUpload(file);
    }
    if (e.target) e.target.value = '';
    setTargetAppendId(null);
  };

  // Filter sessions by search query
  const filteredSessions = useMemo(() => {
    return sessions
      .filter(s => !hiddenSessions.has(s.sessionId))
      .filter(s => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase().trim();
        const matchName = (s.campaignName || "").toLowerCase().includes(q);
        const matchFile = (s.fileName || "").toLowerCase().includes(q);
        return matchName || matchFile;
      });
  }, [sessions, hiddenSessions, searchQuery]);

  if (sessions.length === 0) {
    return (
      <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mx-auto mb-3">
          <History className="h-6 w-6" />
        </div>
        <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-1">
          No Past Campaigns Yet
        </h3>
        <p className="text-slate-500 dark:text-slate-400 text-xs max-w-sm mx-auto">
          Upload your first CSV or Excel file above to launch an automated outreach campaign.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <input type="file" ref={fileInputRef} className="hidden" accept=".csv,.xlsx" onChange={onFileSelected} />

      {/* Chrome / YouTube Style Header with Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
            <History className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Campaign & Import History
              <span className="text-[11px] font-medium text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                {sessions.length} {sessions.length === 1 ? "run" : "runs"}
              </span>
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Hover over any past campaign to view its details, prospects, and execution logs.
            </p>
          </div>
        </div>

        {/* Search & Clear Actions */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-60">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input
              placeholder="Search campaigns..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
            />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30 border-rose-200 dark:border-rose-900/50 rounded-xl gap-1.5 shrink-0 shadow-2xs"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Clear All</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 p-1.5 rounded-xl shadow-lg border border-slate-200 dark:border-slate-800">
              <div className="px-2 py-1.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Clear Campaign Data
              </div>
              <DropdownMenuItem
                onClick={() => {
                  setSelectedTimeframe("24h");
                  setClearDialogOpen(true);
                }}
                className="text-xs cursor-pointer rounded-lg py-2 focus:bg-slate-100 dark:focus:bg-slate-800"
              >
                Past 24 Hours (Past Day)
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setSelectedTimeframe("7d");
                  setClearDialogOpen(true);
                }}
                className="text-xs cursor-pointer rounded-lg py-2 focus:bg-slate-100 dark:focus:bg-slate-800"
              >
                Past 7 Days (Past Week)
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setSelectedTimeframe("30d");
                  setClearDialogOpen(true);
                }}
                className="text-xs cursor-pointer rounded-lg py-2 focus:bg-slate-100 dark:focus:bg-slate-800"
              >
                Past 30 Days (Past Month)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  setSelectedTimeframe("all");
                  setClearDialogOpen(true);
                }}
                className="text-xs cursor-pointer text-rose-600 dark:text-rose-400 focus:text-rose-700 focus:bg-rose-50 dark:focus:bg-rose-950/50 rounded-lg py-2 font-semibold"
              >
                Clear All Data (Full)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Chrome / YouTube Minimalist List */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden divide-y divide-slate-100 dark:divide-slate-800/80">
        <AnimatePresence initial={false}>
          {filteredSessions.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              No campaigns match &quot;{searchQuery}&quot;
            </div>
          ) : (
            filteredSessions.map((session) => {
              const isCompleted = session.status === "COMPLETED";
              const isPaused = pauseResumeEnabled && (session.status === "PAUSED" || (session.lastCheckpoint as string) === "PAUSED");
              const isLive = !isCompleted && !isPaused && (session.lastCheckpoint === "EXECUTION_STARTED" || session.status === "EXECUTING" || session.status === "PAUSED" || (session.lastCheckpoint as string) === "PAUSED");

              return (
                <motion.div
                  key={session.sessionId}
                  layout
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                  onClick={() => handleOpenDetails(session)}
                  className="group relative flex flex-col sm:flex-row sm:items-center justify-between p-3.5 sm:px-5 gap-3 cursor-pointer hover:bg-slate-50/90 dark:hover:bg-slate-800/40 transition-colors"
                >
                  {/* Left: Campaign Icon & Info */}
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 border ${
                      isCompleted 
                        ? "bg-blue-50 dark:bg-blue-950/50 text-blue-600 border-blue-200/60" 
                        : isLive
                        ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 border-emerald-200/60"
                        : isPaused
                        ? "bg-amber-50 dark:bg-amber-950/50 text-amber-600 border-amber-200/60"
                        : "bg-slate-50 dark:bg-slate-800/50 text-slate-600 border-slate-200/60"
                    }`}>
                      {isCompleted ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : isLive ? (
                        <Play className="h-4 w-4 fill-current animate-pulse" />
                      ) : isPaused ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <FolderOpen className="h-4 w-4" />
                      )}
                    </div>


                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs sm:text-sm text-slate-900 dark:text-white group-hover:text-primary transition-colors truncate">
                          {session.campaignName || "Untitled Campaign"}
                        </span>
                        
                        <Badge
                          variant="outline"
                          className={`text-[9px] px-1.5 py-0 rounded-full font-bold uppercase shrink-0 ${
                            isCompleted
                              ? "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200/60"
                              : isLive
                              ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200/60"
                              : isPaused
                              ? "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200/60"
                              : "bg-slate-50 dark:bg-slate-800 text-slate-600 border-slate-200/60"
                          }`}
                        >
                          {isCompleted ? "COMPLETED" : isLive ? "LIVE CAMPAIGN" : isPaused ? "PAUSED" : session.status}
                        </Badge>
                      </div>

                      {/* YouTube/Chrome Style Metadata Row */}
                      <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-slate-400 mt-0.5">
                        <span className="font-medium text-slate-600 dark:text-slate-300">
                          {session.totalRecords.toLocaleString()} {session.totalRecords === 1 ? "Lead" : "Leads"}
                        </span>
                        <span>•</span>
                        <span>{formatDistanceToNow(new Date(session.importDate), { addSuffix: true })}</span>
                        <span>•</span>
                        <span className="truncate max-w-[200px] sm:max-w-xs">{session.fileName}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Hover-Revealed Actions (YouTube/Chrome Style) */}
                  <div 
                    className="flex items-center gap-1.5 shrink-0 self-end sm:self-center opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {pauseResumeEnabled && isLive && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTogglePause(session)}
                        className="h-7 px-2.5 text-xs font-semibold bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 hover:bg-amber-100 border-amber-200 rounded-lg gap-1"
                      >
                        <Pause className="h-3 w-3" />
                        Pause
                      </Button>
                    )}

                    {pauseResumeEnabled && isPaused && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTogglePause(session)}
                        className="h-7 px-2.5 text-xs font-semibold bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 border-emerald-200 rounded-lg gap-1"
                      >
                        <Play className="h-3 w-3" />
                        Resume
                      </Button>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenDashboard(session.sessionId)}
                      className="h-7 px-2.5 text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 border-primary/20 rounded-lg gap-1.5"
                    >
                      <FileText className="h-3 w-3" />
                      View Details
                    </Button>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg">
                          <MoreVertical className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40 rounded-xl shadow-lg">
                        {pauseResumeEnabled && (isLive || isPaused) && (
                          <DropdownMenuItem onClick={() => handleTogglePause(session)}>
                            {isPaused ? <Play className="h-3.5 w-3.5 mr-2 text-emerald-600" /> : <Pause className="h-3.5 w-3.5 mr-2 text-amber-600" />}
                            {isPaused ? "Resume Sending" : "Pause Sending"}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => handleRename(session.sessionId, session.campaignName || "Draft Campaign")}>
                          <Edit2 className="h-3.5 w-3.5 mr-2" />
                          Rename
                        </DropdownMenuItem>

                        <DropdownMenuItem 
                          onClick={() => setShareModalSession({
                            id: (session as any).campaignId || session.sessionId,
                            name: session.campaignName || "Campaign Report"
                          })}
                          className="cursor-pointer"
                        >
                          <Share2 className="h-3.5 w-3.5 mr-2 text-primary" />
                          Share Client Report
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          onClick={() => setSessionToDelete({ id: session.sessionId, name: session.campaignName || "Campaign" })}
                          className="text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/50 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-2" />
                          Delete Campaign
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>

            {/* Clean & Simple Campaign Info Modal */}
      <Dialog open={!!activeDetailsSession} onOpenChange={(open) => !open && setActiveDetailsSession(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl p-5 gap-4">
          {activeDetailsSession && (
            <div className="space-y-4">
              {/* Header */}
              <div className="space-y-1.5 pr-8">
                <div className="flex items-center gap-2 flex-wrap">
                  <DialogTitle className="text-base font-bold text-slate-900 dark:text-white truncate">
                    {activeDetailsSession.campaignName || "Untitled Campaign"}
                  </DialogTitle>
                  <Badge
                    variant="outline"
                    className="text-[10px] font-semibold px-2 py-0.5 bg-emerald-50 text-emerald-700 border-emerald-200 shrink-0"
                  >
                    {activeDetailsSession.status === "COMPLETED" ? "Completed" : "Live"}
                  </Badge>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <span className="font-medium text-slate-600 dark:text-slate-300">{activeDetailsSession.totalRecords} Leads</span>
                  <span>•</span>
                  <span className="truncate max-w-[180px]">{activeDetailsSession.fileName}</span>
                  <span>•</span>
                  <span>{format(new Date(activeDetailsSession.importDate), "MMM d, h:mm a")}</span>
                </div>
              </div>


              {/* Clean Prospects List */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Leads in this campaign
                </div>

                {isLoadingDataset ? (
                  <div className="h-24 flex items-center justify-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-900 rounded-xl">
                    Loading leads...
                  </div>
                ) : activeDataset?.validatedRecords && activeDataset.validatedRecords.length > 0 ? (
                  <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-100 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                    {activeDataset.validatedRecords.slice(0, 10).map((record: any, idx: number) => (
                      <div key={idx} className="px-3 py-2 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-medium text-slate-900 dark:text-white truncate">
                            {record.firstName || record.lastName ? `${record.firstName || ""} ${record.lastName || ""}`.trim() : record.email.split("@")[0]}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate">{record.email}</div>
                        </div>
                        {record.company && (
                          <span className="text-[10px] text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded shrink-0">
                            {record.company}
                          </span>
                        )}
                      </div>
                    ))}
                    {activeDataset.validatedRecords.length > 10 && (
                      <div className="p-2 text-center text-[11px] text-slate-400 bg-slate-50 dark:bg-slate-900">
                        + {activeDataset.validatedRecords.length - 10} more leads
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-900 rounded-xl border">
                    {activeDetailsSession.totalRecords} leads scheduled in campaign.
                  </div>
                )}
              </div>

              {/* Close Button */}
              <DialogFooter className="pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setActiveDetailsSession(null)}
                  className="w-full sm:w-auto rounded-xl text-xs"
                >
                  Close
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert */}
      <AlertDialog open={!!sessionToDelete} onOpenChange={(open) => !open && setSessionToDelete(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader className="sm:flex-row sm:items-start gap-4 space-y-0 text-left">
            <div className="mx-auto sm:mx-0 h-11 w-11 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0 border border-red-500/20">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="space-y-1 flex-1 text-center sm:text-left">
              <AlertDialogTitle className="text-base font-bold text-slate-900 dark:text-white">
                Delete Campaign
              </AlertDialogTitle>
              <AlertDialogDescription className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Are you sure you want to delete <span className="font-semibold text-slate-900 dark:text-white">{sessionToDelete?.name}</span>? All scheduled emails in this campaign will be cancelled.
              </AlertDialogDescription>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-2 sm:mt-0 gap-2">
            <AlertDialogCancel className="rounded-xl text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteSession}
              className="bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold"
            >
              Delete Campaign
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear Data Confirmation Dialog */}
      <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <AlertDialogContent className="rounded-2xl max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-rose-600 dark:text-rose-400 text-base font-bold">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              Clear {selectedTimeframe === "24h" ? "Past 24 Hours" : selectedTimeframe === "7d" ? "Past 7 Days" : selectedTimeframe === "30d" ? "Past 30 Days" : "All"} Data?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-600 dark:text-slate-400 space-y-2 pt-2 text-left leading-relaxed">
              <span>
                This will permanently delete campaigns, prospects, sequences, scheduled steps, and tracking events created within this timeframe from the database and session storage.
              </span>
              <span className="block text-slate-500 dark:text-slate-400 pt-1">
                Note: Real inbox sending metrics and daily account safety limits are preserved.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel disabled={isClearing} className="rounded-xl text-xs">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isClearing}
              onClick={(e) => {
                e.preventDefault();
                handleClearHistory(selectedTimeframe);
              }}
              className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold gap-1.5"
            >
              {isClearing ? "Clearing..." : "Yes, Clear Data"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 1-Click Executive Client Report & PDF Modal (SILAER 10X) */}
      <ShareReportModal
        isOpen={!!shareModalSession}
        onClose={() => setShareModalSession(null)}
        campaignId={shareModalSession?.id || ""}
        campaignName={shareModalSession?.name || "Campaign Report"}
      />
    </div>
  );
}
