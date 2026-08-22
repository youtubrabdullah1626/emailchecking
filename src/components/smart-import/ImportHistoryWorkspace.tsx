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
  FolderOpen
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDistanceToNow, format } from "date-fns";
import { Input } from "@/components/ui/input";
import { useSWRConfig } from "swr";
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
  const { sessionId, handleFileUpload, setAppendTargetSessionId } = useImport() as any;
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

  const loadSessions = useCallback(async () => {
    let all = storage.getAllSessions();
    
    // Auto-update COMPLETED status for LIVE CAMPAIGNS that have no pending items
    for (const session of all) {
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
    }
    
    // Sort newest first
    all.sort((a, b) => new Date(b.importDate).getTime() - new Date(a.importDate).getTime());
    setSessions([...all]);
  }, [storage]);

  useEffect(() => {
    loadSessions();
    const interval = setInterval(loadSessions, 3000);
    return () => clearInterval(interval);
  }, [sessionId, loadSessions]);

  // Track hidden sessions (optimistic delete) and timers
  const [hiddenSessions, setHiddenSessions] = useState<Set<string>>(new Set());
  const [sessionToDelete, setSessionToDelete] = useState<{ id: string; name: string } | null>(null);
  const deleteTimers = React.useRef<Record<string, NodeJS.Timeout>>({});

  const handleResume = (id: string) => {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem("smart_import_active_session_id", id);
    }
    window.location.reload();
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

    // Optimistically hide from UI
    setHiddenSessions(prev => new Set(prev).add(id));

    try {
      // 1. Get campaignId if stored in dataset
      const dataset = await storage.loadHeavyDataset(id).catch(() => null);
      const targetCampaignId = dataset?.campaignId || id;

      // 2. Call instant DB delete
      await fetch(`/api/campaigns/${targetCampaignId}`, {
        method: "DELETE",
      }).catch(() => {});

      // 3. Delete session from local storage & IndexedDB
      await storage.deleteSession(id);

      // 4. Clean active session pointers if this campaign was active
      if (typeof window !== "undefined") {
        if (localStorage.getItem("silaer_active_campaign_id") === targetCampaignId) {
          localStorage.removeItem("silaer_active_campaign_id");
        }
        if (sessionStorage.getItem("smart_import_active_session_id") === id) {
          sessionStorage.removeItem("smart_import_active_session_id");
        }
      }

      // 5. Instantly refresh sessions and SWR cache across entire app
      await loadSessions();
      await mutate(() => true, undefined, { revalidate: true });

      toast.success(`Campaign "${name}" deleted successfully.`);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete campaign");
      await loadSessions();
    }
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
      await mutate(() => true, undefined, { revalidate: true });

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
              const isPaused = session.status === "PAUSED" || (session.lastCheckpoint as string) === "PAUSED";
              const isLive = !isCompleted && !isPaused && (session.lastCheckpoint === "EXECUTION_STARTED" || session.status === "EXECUTING");

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
                    {isLive && (
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

                    {isPaused && (
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

                    {isLive && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAppendClick(session.sessionId)}
                        className="h-7 px-2.5 text-xs font-semibold bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 border-emerald-200 rounded-lg gap-1"
                      >
                        <Plus className="h-3 w-3" />
                        Add Leads
                      </Button>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenDetails(session)}
                      className="h-7 px-2.5 text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 border-primary/20 rounded-lg gap-1.5"
                    >
                      <FileText className="h-3 w-3" />
                      View Details
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        window.location.href = "/prospects";
                      }}
                      className="h-7 px-2 text-xs font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-lg gap-1"
                    >
                      <Eye className="h-3 w-3" />
                      View Prospects
                    </Button>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg">
                          <MoreVertical className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40 rounded-xl shadow-lg">
                        <DropdownMenuItem onClick={() => handleOpenDetails(session)}>
                          <FileText className="h-3.5 w-3.5 mr-2" />
                          View Full Details
                        </DropdownMenuItem>
                        {(isLive || isPaused) && (
                          <DropdownMenuItem onClick={() => handleTogglePause(session)}>
                            {isPaused ? <Play className="h-3.5 w-3.5 mr-2 text-emerald-600" /> : <Pause className="h-3.5 w-3.5 mr-2 text-amber-600" />}
                            {isPaused ? "Resume Sending" : "Pause Sending"}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => handleResume(session.sessionId)}>
                          <Play className="h-3.5 w-3.5 mr-2" />
                          Resume / Reload
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleRename(session.sessionId, session.campaignName || "Draft Campaign")}>
                          <Edit2 className="h-3.5 w-3.5 mr-2" />
                          Rename
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

      {/* Rich Interactive Details Modal */}
      <Dialog open={!!activeDetailsSession} onOpenChange={(open) => !open && setActiveDetailsSession(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] p-6 rounded-2xl">
          {activeDetailsSession && (
            <div className="space-y-5">
              <DialogHeader>
                <div className="flex items-center gap-2 mb-1">
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-bold ${
                      activeDetailsSession.status === "COMPLETED"
                        ? "bg-blue-50 text-blue-700 border-blue-200"
                        : activeDetailsSession.lastCheckpoint === "EXECUTION_STARTED"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-amber-50 text-amber-700 border-amber-200"
                    }`}
                  >
                    {activeDetailsSession.status}
                  </Badge>
                  <span className="text-xs text-slate-400">
                    Imported {format(new Date(activeDetailsSession.importDate), "MMM d, yyyy, h:mm a")}
                  </span>
                </div>
                <DialogTitle className="text-lg font-bold text-slate-900 dark:text-white">
                  {activeDetailsSession.campaignName || "Untitled Campaign"}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
                  File: <span className="font-medium text-slate-700 dark:text-slate-300">{activeDetailsSession.fileName}</span>
                </DialogDescription>
              </DialogHeader>

              {/* KPI Summary Cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-center">
                  <div className="text-xs text-slate-500 font-medium">Total Leads</div>
                  <div className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                    {activeDetailsSession.totalRecords.toLocaleString()}
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-center">
                  <div className="text-xs text-slate-500 font-medium">Valid Records</div>
                  <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {activeDataset?.validatedRecords?.length || activeDetailsSession.totalRecords}
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-center">
                  <div className="text-xs text-slate-500 font-medium">Status</div>
                  <div className="text-xs font-bold text-primary mt-1.5 uppercase">
                    {activeDetailsSession.lastCheckpoint || activeDetailsSession.status}
                  </div>
                </div>
              </div>

              {/* Prospects Preview in this Campaign */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>Prospects in Campaign</span>
                  <span className="text-[11px] text-slate-400">
                    {activeDataset?.validatedRecords?.length || activeDetailsSession.totalRecords} contacts
                  </span>
                </div>

                {isLoadingDataset ? (
                  <div className="h-32 flex items-center justify-center text-xs text-slate-400 animate-pulse bg-slate-50 dark:bg-slate-900 rounded-xl border">
                    Loading campaign details...
                  </div>
                ) : activeDataset?.validatedRecords && activeDataset.validatedRecords.length > 0 ? (
                  <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                    {activeDataset.validatedRecords.slice(0, 10).map((record: any, idx: number) => (
                      <div key={idx} className="p-2.5 flex items-center justify-between gap-2 hover:bg-slate-50/50">
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 dark:text-white truncate">
                            {record.firstName || record.lastName ? `${record.firstName || ""} ${record.lastName || ""}`.trim() : record.name || "Lead"}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">{record.email}</div>
                        </div>
                        {record.company && (
                          <span className="text-[11px] text-slate-500 shrink-0 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                            {record.company}
                          </span>
                        )}
                      </div>
                    ))}
                    {activeDataset.validatedRecords.length > 10 && (
                      <div className="p-2 text-center text-[11px] text-slate-400 font-medium bg-slate-50 dark:bg-slate-900">
                        + {activeDataset.validatedRecords.length - 10} more prospects
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-4 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-900 rounded-xl border">
                    Detailed records stored in Prospects CRM.
                  </div>
                )}
              </div>

              {/* Action Buttons in Modal */}
              <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setActiveDetailsSession(null);
                    window.location.href = "/prospects";
                  }}
                  className="rounded-xl text-xs"
                >
                  <Users className="h-3.5 w-3.5 mr-1.5" />
                  View in Prospects CRM
                </Button>

                <Button
                  size="sm"
                  onClick={() => handleResume(activeDetailsSession.sessionId)}
                  className="rounded-xl text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                >
                  <Play className="h-3.5 w-3.5 mr-1.5" />
                  Open Live Dashboard
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
    </div>
  );
}
