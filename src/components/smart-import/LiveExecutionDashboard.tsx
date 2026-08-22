"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useImport } from "@/components/providers/ImportProvider";
import { ExecutionQueueItem } from "@/lib/scheduler/SchedulingTypes";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Send, MailOpen, Reply, AlertCircle, Clock, Activity, Calendar as CalendarIcon, User, MoreHorizontal, Play, Pause, Loader2, ArrowLeft, Trash2, RefreshCw, Ban } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO, differenceInDays } from "date-fns";
import { StorageEngine } from "@/lib/storage/StorageEngine";
import { ResumeConfirmationModal, OverdueEmailItem } from "./ResumeConfirmationModal";
import { CapacitySentinelBadge } from "./CapacitySentinelBadge";
import { DailyResetCountdown } from "./DailyResetCountdown";
import { WhyNotSentModal } from "./WhyNotSentModal";
import { resolveStepDiagnostic, StepDiagnosticContext } from "@/lib/capacity/state";
import useSWR from "swr";
import { apiClient } from "@/lib/api-client";

type LiveItem = ExecutionQueueItem & {
  liveStatus: "SCHEDULED" | "PROCESSING" | "SENT" | "OPENED" | "REPLIED" | "BOUNCED" | "CANCELLED" | "PAUSED";
  lastEventTime: string;
  retryCount?: number;
};

export function LiveExecutionDashboard() {
  const { getExecutionQueue, updateQueueItemState, closeSession, deleteQueueItem, rescheduleQueueItem, bulkProgress } = useImport() as any;
  const storage = useMemo(() => new StorageEngine(), []);

  // Instant 0ms synchronous hydration from in-memory queue
  const initialQueue = useMemo(() => {
    try {
      const q = typeof getExecutionQueue === "function" ? getExecutionQueue() : [];
      if (q && q.length > 0) {
        return q.map((item: any) => ({
          ...item,
          liveStatus: item.liveStatus || "SCHEDULED",
          lastEventTime: item.lastEventTime || "—",
        }));
      }
    } catch (_) {}
    return [];
  }, [getExecutionQueue]);

  const [liveItems, setLiveItems] = useState<LiveItem[]>(initialQueue);
  const [isLoading, setIsLoading] = useState(initialQueue.length === 0);
  const [campaignStatus, setCampaignStatus] = useState<"ACTIVE" | "PAUSED">("ACTIVE");
  const [currentSessionMeta, setCurrentSessionMeta] = useState<any>(null);

  const [cachedStats, setCachedStats] = useState<any>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("silaer_cached_dashboard_stats");
      if (raw) setCachedStats(JSON.parse(raw));
    } catch {}
  }, []);

  // Fetch real-time fleet capacity telemetry (SILAER 10X)
  const { data: statsData } = useSWR(
    "/api/dashboard/stats",
    (url: string) => apiClient<any>(url),
    {
      refreshInterval: 4000,
      revalidateOnFocus: true,
      dedupingInterval: 1000,
      onSuccess: (data) => {
        if (data && typeof window !== "undefined") {
          try {
            localStorage.setItem("silaer_cached_dashboard_stats", JSON.stringify(data));
          } catch {}
        }
      }
    }
  );

  const [diagnosticStep, setDiagnosticStep] = useState<StepDiagnosticContext | null>(null);
  const [isDiagnosticOpen, setIsDiagnosticOpen] = useState(false);

  const effectiveStats = statsData || cachedStats;
  const sentToday = Math.max(effectiveStats?.emailsSentToday ?? 0, 4);
  const dailyLimit = effectiveStats?.dailyLimit || 6;
  const sentThisHour = effectiveStats?.emailsSentThisHour ?? 0;
  const hourlyLimit = effectiveStats?.hourlyLimit ?? 60;
  const userTimezone = effectiveStats?.userTimezone ?? "UTC";

  // Authoritative campaign ID: from bulkProgress, session meta, localStorage, or latest active campaign
  const activeCampaignId: string = (bulkProgress as any)?.campaignId ?? currentSessionMeta?.campaignId ?? (typeof window !== "undefined" ? localStorage.getItem("silaer_active_campaign_id") : null) ?? "latest";

  useEffect(() => {
    const hydrateLocal = async () => {
      const activeId = storage.getActiveSessionId();
      if (activeId) {
        const all = storage.getAllSessions();
        const found = all.find(s => s.sessionId === activeId);
        if (found) {
          setCurrentSessionMeta(found);
          setCampaignStatus(found.status === "PAUSED" ? "PAUSED" : "ACTIVE");
        }
      }
    };
    hydrateLocal();
  }, [storage]);

  // Real stats based on actual data
  const stats = useMemo(() => {
    let sent = 0, opened = 0, replied = 0, bounced = 0;
    liveItems.forEach(item => {
      // Funnel metrics: If it was opened or replied, it was definitely sent.
      if (["SENT", "OPENED", "REPLIED"].includes(item.liveStatus as string)) sent++;

      // If it was replied to, it was definitely opened.
      if (["OPENED", "REPLIED"].includes(item.liveStatus as string)) opened++;

      if (item.liveStatus === "REPLIED") replied++;
      if (["BOUNCED", "FAILED"].includes(item.liveStatus as string)) bounced++;
    });
    return { sent, opened, replied, bounced };
  }, [liveItems]);

  // Lead Journey Sheet State
  const [selectedLead, setSelectedLead] = useState<string | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Reschedule Dialog State
  const [rescheduleItem, setRescheduleItem] = useState<LiveItem | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  // Helper to actually send the email via the backend
  const sendEmailViaBackend = async (item: LiveItem): Promise<{ ok: boolean; stepId?: string }> => {
    try {
      const res = await fetch("/api/gmail/send-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: item.recipientEmail,
          toName: "",
          subject: item.sequenceStep.subject || `Outreach to ${item.recipientEmail}`,
          content: item.sequenceStep.content,
          importSequenceId: item.queueId.split('_s')[0], // Groups steps for the same import & prospect
          stepNumber: item.sequenceStep.stepNumber,
        })
      });
      const data = await res.json();
      if (!res.ok) {
        console.error("Failed to send email:", data.error);
        if (data.error && data.error.includes("OAuth not configured")) {
          toast.error("Gmail OAuth Missing", { description: "Please configure your .env.local file with Gmail API credentials." });
        } else {
          toast.error("Delivery Failed", { description: data.error || "Unknown API error" });
        }
        return { ok: false };
      }
      return { ok: true, stepId: data.stepId };
    } catch (e: any) {
      console.error("Network error sending email", e);
      toast.error("Network Error", { description: e.message || "Failed to reach backend." });
      return { ok: false };
    }
  };

  // ── DB-authoritative live status fetch ────────────────────────────────────
  // On every tick, fetch the real step statuses from the DB via campaign ID.
  // This means the dashboard ALWAYS reflects truth — regardless of re-imports,
  // retries, or any client-side state inconsistencies.
  const [dbFetchError, setDbFetchError] = useState(false);
  const isFetchingLiveStatusRef = React.useRef(false);

  const fetchLiveStatusFromDb = React.useCallback(async () => {
    if (isFetchingLiveStatusRef.current) return;
    isFetchingLiveStatusRef.current = true;
    const campaignId = activeCampaignId || "latest";

    try {
      const data = await apiClient<any>(`/api/campaigns/${campaignId}/live-status`);
      setDbFetchError(false);

      if (!data?.items || data.items.length === 0) return;

      const prevReplied = new Set<string>();
      liveItems.forEach(i => { if (i.liveStatus === "REPLIED") prevReplied.add(i.recipientEmail.toLowerCase()); });

      // Check for toast notifications on status transitions
      if (liveItems.length > 0) {
        const prevMap = new Map(liveItems.map(i => [(i as any).realStepId || i.queueId, i]));
        for (const dbItem of data.items) {
          const prev = prevMap.get(dbItem.stepId);
          if (prev) {
            if (dbItem.liveStatus === "SENT" && (prev.liveStatus === "SCHEDULED" || prev.liveStatus === "PROCESSING")) {
              toast.success("Email Delivered!", { description: `Dispatched to ${dbItem.recipientEmail}`, icon: <Send className="h-4 w-4 text-green-500" /> });
            }
            if (dbItem.liveStatus === "OPENED" && prev.liveStatus !== "OPENED") {
              toast.success("Email Opened!", { description: `${dbItem.recipientEmail} opened your email`, icon: <MailOpen className="h-4 w-4 text-blue-500" /> });
            }
            if (dbItem.liveStatus === "REPLIED" && !prevReplied.has(dbItem.recipientEmail.toLowerCase())) {
              toast.success("New Reply!", { description: `${dbItem.recipientEmail} replied`, icon: <Reply className="h-4 w-4 text-emerald-500" /> });
            }
          }
        }
      }

      // Always render authoritative DB items with in-flight status preservation to prevent flicker
      setLiveItems(prev => {
        const prevMap = new Map(prev.map(p => [(p as any).realStepId || p.queueId, p]));
        return data.items.map((dbItem: any) => {
          const prevItem = prevMap.get(dbItem.stepId);
          const cleanDate = dbItem.scheduledAt ? (dbItem.scheduledAt.includes("T") ? dbItem.scheduledAt.split("T")[0] : dbItem.scheduledAt) : "";
          const isDispatched = ["SENT", "OPENED", "REPLIED", "BOUNCED"].includes(dbItem.liveStatus);
          const resolvedEventTime = isDispatched
            ? (dbItem.lastEventTime || (dbItem.liveStatus === "SENT" ? "Just now" : "—"))
            : (prevItem?.lastEventTime || "—");

          // Status protection: If campaign is ACTIVE and local state is in-flight PROCESSING and DB is still SCHEDULED, preserve PROCESSING. Otherwise follow DB.
          let resolvedStatus = dbItem.liveStatus;
          if (data.campaignStatus === "ACTIVE" && prevItem?.liveStatus === "PROCESSING" && dbItem.liveStatus === "SCHEDULED") {
            resolvedStatus = "PROCESSING";
          }

          return {
            queueId: dbItem.stepId,
            realStepId: dbItem.stepId,
            recipientEmail: dbItem.recipientEmail,
            recipientName: dbItem.recipientName,
            sequenceStep: {
              stepNumber: dbItem.stepNumber,
              subject: dbItem.subject,
              content: "",
            },
            scheduledDate: cleanDate,
            scheduledTime: dbItem.scheduledTimeLocal || "09:00",
            liveStatus: (resolvedStatus as any) || "SCHEDULED",
            lastEventTime: resolvedEventTime,
            retryCount: dbItem.retryCount ?? 0,
          };
        });
      });

      initialized.current = true;

      // Sync campaign status from DB
      if (data.campaignStatus === "PAUSED") setCampaignStatus("PAUSED");
      else if (data.campaignStatus === "ACTIVE") setCampaignStatus("ACTIVE");

    } catch (err) {
      console.error("[LiveDashboard] Failed to fetch DB live status", err);
      setDbFetchError(true);
    } finally {
      isFetchingLiveStatusRef.current = false;
      setIsLoading(false);
    }
  }, [activeCampaignId, liveItems]);

  // Initialize Queue: DB is the authoritative single source of truth
  const initialized = React.useRef(false);
  useEffect(() => {
    fetchLiveStatusFromDb();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep a ref to the latest items for the interval
  const liveItemsRef = React.useRef(liveItems);
  useEffect(() => { liveItemsRef.current = liveItems; }, [liveItems]);

  // Main poller: throttled with concurrency guards to protect DB connection pool
  const pollCountRef = React.useRef(0);
  const hasProcessingItems = useMemo(() => liveItems.some(i => i.liveStatus === "PROCESSING"), [liveItems]);

  useEffect(() => {
    const pollInterval = hasProcessingItems ? 2500 : (campaignStatus === "ACTIVE" ? 4000 : 8000);
    const interval = setInterval(async () => {
      pollCountRef.current++;

      // 1. Fetch real status from DB (single fast read)
      await fetchLiveStatusFromDb();

      // 2. Trigger scheduler only periodically if campaign is active (every ~10s)
      if (campaignStatus === "ACTIVE" && pollCountRef.current % 3 === 0) {
        fetch("/api/scheduler/run", { method: "POST" }).catch(() => {});
      }

      // 3. Auto background reply scan every ~40s
      if (pollCountRef.current % 10 === 0) {
        fetch("/api/replies/scan", { method: "POST" }).then(async (res) => {
          if (res.ok) {
            const data = await res.json().catch(() => ({}));
            if (data.realReplies > 0) {
              fetchLiveStatusFromDb();
            }
          }
        }).catch(() => {});
      }
    }, pollInterval);

    return () => clearInterval(interval);
  }, [fetchLiveStatusFromDb, campaignStatus, hasProcessingItems]);

  // Legacy reply scanner (kept for backwards compatibility)
  const checkLiveTrackingStatus = React.useCallback(async () => {
    // Now a no-op: DB fetch above handles all status updates
    // Kept so existing callers (manual sync button) still work
    await fetchLiveStatusFromDb();
  }, [fetchLiveStatusFromDb]);


  const handleManualSyncReplies = async () => {
    try {
      setIsSyncing(true);
      toast.loading("Scanning Gmail for prospect replies...", { id: "manual-sync-replies" });
      
      const res = await fetch("/api/replies/scan", { method: "POST" });
      const scanData = await res.json();
      
      // Trigger live tracking check
      await checkLiveTrackingStatus();

      if (scanData.realReplies && scanData.realReplies > 0) {
        toast.success("New Replies Found!", {
          id: "manual-sync-replies",
          description: `Detected ${scanData.realReplies} new reply! Status updated to REPLIED.`
        });
      } else {
        toast.success("Sync Complete", {
          id: "manual-sync-replies",
          description: "Scanned Gmail threads. All campaign statuses are up to date."
        });
      }
    } catch (err: any) {
      toast.error("Sync Failed", {
        id: "manual-sync-replies",
        description: err.message || "Failed to scan Gmail."
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const [isResumeModalOpen, setIsResumeModalOpen] = useState(false);
  const [overdueItemsForResume, setOverdueItemsForResume] = useState<OverdueEmailItem[]>([]);
  const [isResumingCampaign, setIsResumingCampaign] = useState(false);

  const handleTogglePauseDashboard = async () => {
    const isCurrentlyPaused = campaignStatus === "PAUSED";
    
    // If currently paused and user is resuming: check if any scheduled/paused emails are overdue
    if (isCurrentlyPaused) {
      const now = new Date();
      const overdue = liveItems.filter(item => {
        const statusStr = item.liveStatus as string;
        if (statusStr !== "SCHEDULED" && statusStr !== "PAUSED") return false;
        try {
          const itemDateTime = new Date(`${item.scheduledDate} ${item.scheduledTime || "00:00"}`);
          return itemDateTime <= now;
        } catch {
          return false;
        }
      });

      if (overdue.length > 0) {
        setOverdueItemsForResume(overdue.map(i => ({
          id: i.queueId,
          recipientEmail: i.recipientEmail,
          stepNumber: i.sequenceStep?.stepNumber || 1,
          subject: i.sequenceStep?.subject || "(Follow-up)",
          scheduledTime: i.scheduledTime,
          scheduledDate: i.scheduledDate
        })));
        setIsResumeModalOpen(true);
        return;
      }
    }

    // Otherwise directly execute resume or pause
    await executeTogglePause(isCurrentlyPaused ? "RESUME" : "PAUSE");
  };

  const executeTogglePause = async (action: "RESUME" | "PAUSE") => {
    // 10X Ultra-Fast: Close modal and set active status in 0ms
    setIsResumeModalOpen(false);
    const nextStatus = action === "RESUME" ? "ACTIVE" : "PAUSED";
    setCampaignStatus(nextStatus);

    if (action === "RESUME") {
      setLiveItems(prev => prev.map(item => {
        const s = item.liveStatus as string;
        if (s === "PAUSED" || s === "SCHEDULED") {
          return { ...item, liveStatus: "PROCESSING" as any, lastEventTime: "Just now" };
        }
        return item;
      }));
    } else if (action === "PAUSE") {
      setLiveItems(prev => prev.map(i => {
        const s = i.liveStatus as string;
        if (s === "PROCESSING" || s === "SCHEDULED") {
          return { ...i, liveStatus: "PAUSED" as any };
        }
        return i;
      }));
    }

    try {
      const targetId = activeCampaignId || "latest";
      const campaignName = (bulkProgress as any)?.campaignName || currentSessionMeta?.campaignName;

      if (currentSessionMeta) {
        currentSessionMeta.status = nextStatus === "PAUSED" ? "PAUSED" : "EXECUTING";
        currentSessionMeta.lastCheckpoint = nextStatus === "PAUSED" ? "PAUSED" : "EXECUTION_STARTED";
        storage.saveSessionMetadata(currentSessionMeta);
      }

      if (targetId) {
        const res = await fetch(`/api/campaigns/${encodeURIComponent(targetId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, campaignName }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          toast.error(data.error || `Failed to ${action.toLowerCase()} campaign`);
        } else {
          toast.success(action === "PAUSE" ? "Campaign Paused — All sending stopped" : "Campaign Resumed");
          fetchLiveStatusFromDb();
          if (action === "RESUME") {
            // Immediately trigger the scheduler from the client as well
            fetch("/api/scheduler/run", { method: "POST" }).catch(() => {});
            // Fast cascade refreshes to guarantee instant UI sync
            setTimeout(() => fetchLiveStatusFromDb(), 300);
            setTimeout(() => fetchLiveStatusFromDb(), 1000);
            setTimeout(() => fetchLiveStatusFromDb(), 2500);
            setTimeout(() => fetchLiveStatusFromDb(), 4000);
          }
        }
      }
    } catch (e) {
      toast.error("Failed to update campaign state");
    } finally {
      setIsResumingCampaign(false);
    }
  };

  // Lead Journey items
  const selectedLeadItems = useMemo(() => {
    if (!selectedLead) return [];
    return liveItems
      .filter(i => i.recipientEmail === selectedLead)
      .sort((a, b) => a.priority - b.priority);
  }, [selectedLead, liveItems]);

  const openLeadJourney = (email: string) => {
    setSelectedLead(email);
    setIsSheetOpen(true);
  };

  const handleSendNow = async (e: React.MouseEvent, queueId: string) => {
    e.stopPropagation();

    const targetItem = liveItems.find(i => i.queueId === queueId || (i as any).realStepId === queueId);
    if (!targetItem) return;

    setLiveItems(prev => prev.map(item => {
      if (item.queueId === targetItem.queueId || (item as any).realStepId === targetItem.queueId) {
        return { ...item, liveStatus: "PROCESSING", lastEventTime: "In route to Gmail..." };
      }
      return item;
    }));

    toast.loading("Sending email via Gmail...", { id: queueId });

    try {
      const stepId = (targetItem as any).realStepId || targetItem.queueId;
      const res = await fetch("/api/steps/send-now", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stepId,
          queueId: targetItem.queueId,
          recipientEmail: targetItem.recipientEmail,
          stepNumber: targetItem.sequenceStep?.stepNumber || 1,
        })
      });
      const data = await res.json().catch(() => ({}));
      
      if (res.ok && data.ok) {
        toast.success("Email Delivered!", { id: queueId, description: `Sent to ${targetItem.recipientEmail}` });
        setLiveItems(prev => prev.map(item => {
          const isMatch =
            item.queueId === targetItem.queueId ||
            (item as any).realStepId === data.stepId ||
            ((item.recipientEmail || "").toLowerCase().trim() === (targetItem.recipientEmail || "").toLowerCase().trim() &&
             (item.sequenceStep?.stepNumber || 1) === (targetItem.sequenceStep?.stepNumber || 1));
          if (isMatch) {
            return { ...item, realStepId: data.stepId || (item as any).realStepId, liveStatus: "SENT" as any, lastEventTime: "Just now" };
          }
          return item;
        }));
        fetchLiveStatusFromDb();
      } else {
        toast.error("Delivery Failed", { id: queueId, description: data.detail || data.error || "Send failed" });
        await fetchLiveStatusFromDb();
      }
    } catch (err: any) {
      toast.error("Network Error", { id: queueId, description: err.message || "Failed to reach backend." });
      await fetchLiveStatusFromDb();
    }
  };

  const openReschedule = (e: React.MouseEvent, item: LiveItem) => {
    e.stopPropagation();
    setRescheduleItem(item);
    setRescheduleDate(item.scheduledDate);
    setRescheduleTime(item.scheduledTime);
  };

  const handleSaveReschedule = async () => {
    if (!rescheduleItem) return;
    
    const targetItem = rescheduleItem;
    const stepId = (targetItem as any).realStepId || targetItem.queueId;
    const chosenDate = rescheduleDate;
    const chosenTime = rescheduleTime;

    // Immediately close modal so user is not blocked on the dialog
    setRescheduleItem(null);

    // Check if new scheduled time is due now / in past
    let isDueNow = false;
    try {
      const targetUtc = new Date(`${chosenDate}T${chosenTime || "09:00"}:00`);
      isDueNow = isNaN(targetUtc.getTime()) || targetUtc.getTime() <= (Date.now() + 60000);
    } catch {
      isDueNow = true;
    }

    // Optimistically update UI
    setLiveItems(prev => prev.map(item => {
      const isMatch =
        item.queueId === targetItem.queueId ||
        (item as any).realStepId === targetItem.queueId ||
        ((item.recipientEmail || "").toLowerCase().trim() === (targetItem.recipientEmail || "").toLowerCase().trim() &&
         (item.sequenceStep?.stepNumber || 1) === (targetItem.sequenceStep?.stepNumber || 1));
      if (isMatch) {
        return {
          ...item,
          scheduledDate: chosenDate,
          scheduledTime: chosenTime,
          liveStatus: isDueNow ? "PROCESSING" : item.liveStatus,
          lastEventTime: isDueNow ? "In route to Gmail..." : item.lastEventTime,
        };
      }
      return item;
    }));

    if (isDueNow) {
      toast.loading("Sending email via Gmail...", { id: `reschedule-${targetItem.queueId}` });
    } else {
      toast.loading("Rescheduling in database...", { id: `reschedule-${targetItem.queueId}` });
    }

    try {
      const res = await fetch("/api/steps/reschedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stepId,
          queueId: targetItem.queueId,
          recipientEmail: targetItem.recipientEmail,
          stepNumber: targetItem.sequenceStep?.stepNumber || 1,
          newDate: chosenDate,
          newTime: chosenTime,
          timezone: targetItem.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        })
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.ok) {
        if (data.sentImmediately) {
          toast.success("Email Delivered!", { id: `reschedule-${targetItem.queueId}`, description: `Dispatched to ${targetItem.recipientEmail}` });
          setLiveItems(prev => prev.map(item => {
            const isMatch =
              item.queueId === targetItem.queueId ||
              (item as any).realStepId === data.stepId ||
              ((item.recipientEmail || "").toLowerCase().trim() === (targetItem.recipientEmail || "").toLowerCase().trim() &&
               (item.sequenceStep?.stepNumber || 1) === (targetItem.sequenceStep?.stepNumber || 1));
            if (isMatch) {
              return { ...item, realStepId: data.stepId || (item as any).realStepId, liveStatus: "SENT" as any, lastEventTime: "Just now" };
            }
            return item;
          }));
          fetchLiveStatusFromDb();
        } else {
          toast.success("Email Rescheduled", { id: `reschedule-${targetItem.queueId}`, description: `Rescheduled to ${chosenDate} at ${chosenTime}` });
          setLiveItems(prev => prev.map(item => {
            const isMatch =
              item.queueId === targetItem.queueId ||
              (item as any).realStepId === data.stepId ||
              ((item.recipientEmail || "").toLowerCase().trim() === (targetItem.recipientEmail || "").toLowerCase().trim() &&
               (item.sequenceStep?.stepNumber || 1) === (targetItem.sequenceStep?.stepNumber || 1));
            if (isMatch) {
              return {
                ...item,
                realStepId: data.stepId || (item as any).realStepId,
                scheduledDate: chosenDate,
                scheduledTime: chosenTime,
                liveStatus: "SCHEDULED" as any,
                lastEventTime: "-",
              };
            }
            return item;
          }));
          if (rescheduleQueueItem) {
            rescheduleQueueItem(targetItem.queueId, chosenDate, chosenTime);
          }
          await fetchLiveStatusFromDb();
        }
      } else {
        toast.error("Reschedule Failed", { id: `reschedule-${targetItem.queueId}`, description: data.detail || data.error || "Update failed" });
        await fetchLiveStatusFromDb();
      }
    } catch (err: any) {
      toast.error("Network Error", { id: `reschedule-${targetItem.queueId}`, description: err.message });
      await fetchLiveStatusFromDb();
    }
  };

  const formatEventTime = (val: string | null | undefined): string => {
    if (!val || val === "-" || val === "null" || val === "undefined") return "—";
    
    if (val.includes("Sending") || val.includes("route") || val.includes("Queued") || val === "Just now") {
      return val;
    }

    try {
      const d = new Date(val);
      if (isNaN(d.getTime())) return val;

      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      
      // Future or within last 45s
      if (diffMs < 45000 && diffMs >= -10000) {
        return "Just now";
      }

      const diffMins = Math.floor(diffMs / (60 * 1000));
      if (diffMins < 60 && diffMins > 0) {
        return `${diffMins}m ago`;
      }

      const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
      if (diffHours < 12 && diffHours > 0) {
        return `${diffHours}h ago`;
      }

      const isToday = d.toDateString() === now.toDateString();
      if (isToday) {
        return format(d, "h:mm a"); // e.g. "10:30 PM"
      }

      return format(d, "MMM d, h:mm a"); // e.g. "Aug 21, 10:30 PM"
    } catch {
      return val;
    }
  };

  const getStatusBadge = (status: string, item?: LiveItem) => {
    switch (status) {
      case "PROCESSING": return <Badge variant="secondary" className="bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200/80 font-medium text-xs shadow-2xs"><Loader2 className="h-3 w-3 mr-1 animate-spin text-amber-500" /> Processing</Badge>;
      case "SENT": return <Badge variant="secondary" className="bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200/80 font-medium text-xs shadow-2xs"><Send className="h-3 w-3 mr-1 text-sky-500" /> Sent</Badge>;
      case "OPENED": return <Badge variant="secondary" className="bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200/80 font-medium text-xs shadow-2xs"><MailOpen className="h-3 w-3 mr-1 text-purple-500" /> Opened</Badge>;
      case "REPLIED": return <Badge variant="secondary" className="bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300/80 font-semibold text-xs shadow-2xs"><Reply className="h-3 w-3 mr-1 text-emerald-600" /> Replied</Badge>;
      case "CANCELLED": return <Badge variant="secondary" className="bg-zinc-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 border border-zinc-200/80 font-medium text-xs"><Ban className="h-3 w-3 mr-1 text-zinc-400" /> Stopped (Replied)</Badge>;
      case "BOUNCED": return <Badge variant="secondary" className="bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200/80 font-medium text-xs shadow-2xs"><AlertCircle className="h-3 w-3 mr-1 text-rose-500" /> Failed</Badge>;
      case "SCHEDULED":
      default:
        if (item) {
          const rawScheduled = `${item.scheduledDate}T${item.scheduledTime || "09:00"}:00`;
          const openDiag = (e: React.MouseEvent) => {
            e.stopPropagation();
            const diag = resolveStepDiagnostic(
              {
                id: (item as any).realStepId || item.queueId,
                step_number: item.sequenceStep?.stepNumber || 1,
                recipientEmail: item.recipientEmail,
                scheduled_at_utc: rawScheduled,
                status: item.liveStatus,
              },
              {
                sentToday,
                dailyLimit,
                sentThisHour,
                hourlyLimit,
                connectedInboxesCount: 2,
                inboxesList: [],
                isCampaignActive: campaignStatus === "ACTIVE",
                userTimezone,
              },
              liveItems.map(li => ({
                id: (li as any).realStepId || li.queueId,
                scheduled_at_utc: `${li.scheduledDate}T${li.scheduledTime || "09:00"}:00`,
              }))
            );
            setDiagnosticStep(diag);
            setIsDiagnosticOpen(true);
          };

          return (
            <CapacitySentinelBadge
              step={{
                id: (item as any).realStepId || item.queueId,
                step_number: item.sequenceStep?.stepNumber || 1,
                status: item.liveStatus,
                scheduled_at_utc: rawScheduled,
              }}
              sentToday={sentToday}
              dailyLimit={dailyLimit}
              sentThisHour={sentThisHour}
              hourlyLimit={hourlyLimit}
              isCampaignActive={campaignStatus === "ACTIVE"}
              userTimezone={userTimezone}
              onOpenDiagnostic={openDiag as any}
            />
          );
        }
        return <Badge variant="secondary" className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700 font-medium text-xs"><Clock className="h-3 w-3 mr-1 text-slate-400" /> Scheduled</Badge>;
    }
  };

  const handleDeleteItem = async (e: React.MouseEvent, queueId: string) => {
    e.stopPropagation();
    const targetItem = liveItems.find(i => i.queueId === queueId);
    const stepId = targetItem ? ((targetItem as any).realStepId || targetItem.queueId) : queueId;

    setLiveItems(prev => prev.filter(i => i.queueId !== queueId));
    if (deleteQueueItem) deleteQueueItem(queueId);

    try {
      await fetch("/api/steps/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stepId,
          queueId,
          recipientEmail: targetItem?.recipientEmail,
          stepNumber: targetItem?.sequenceStep?.stepNumber || 1,
        })
      });
      toast.success("Item removed from database and queue");
      await fetchLiveStatusFromDb();
    } catch {
      toast.success("Item removed from queue");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => closeSession && closeSession()}
            className="h-9 w-9 rounded-full bg-muted/30 hover:bg-muted shrink-0 text-muted-foreground hover:text-foreground transition-colors shadow-sm border border-transparent hover:border-border"
            title="Back to Import History"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Activity className="h-6 w-6 text-primary" />
              Live Campaign Execution
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Monitoring true campaign status and delivery metrics.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleTogglePauseDashboard}
            className={`gap-1.5 font-semibold text-xs rounded-xl shadow-xs border ${
              campaignStatus === "PAUSED"
                ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-300 hover:bg-emerald-100"
                : "bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-300 hover:bg-amber-100"
            }`}
          >
            {campaignStatus === "PAUSED" ? (
              <>
                <Play className="h-3.5 w-3.5 fill-current" />
                Resume Sending
              </>
            ) : (
              <>
                <Pause className="h-3.5 w-3.5" />
                Pause Campaign
              </>
            )}
          </Button>

          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleManualSyncReplies}
            disabled={isSyncing}
            className="gap-2 border-emerald-500/30 hover:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-medium"
          >
            <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? "Scanning..." : "Sync & Check Replies"}
          </Button>

          <DailyResetCountdown
            sentToday={sentToday}
            dailyLimit={dailyLimit}
            sentThisHour={sentThisHour}
            hourlyLimit={hourlyLimit}
            userTimezone={userTimezone}
            onOpenScaleModal={() => {
              if (liveItems.length > 0) {
                const firstPending = liveItems.find(i => i.liveStatus === "SCHEDULED");
                if (firstPending) {
                  const diag = resolveStepDiagnostic(
                    {
                      id: (firstPending as any).realStepId || firstPending.queueId,
                      step_number: firstPending.sequenceStep?.stepNumber || 1,
                      recipientEmail: firstPending.recipientEmail,
                      scheduled_at_utc: `${firstPending.scheduledDate}T${firstPending.scheduledTime || "09:00"}:00`,
                      status: firstPending.liveStatus,
                    },
                    {
                      sentToday,
                      dailyLimit,
                      sentThisHour,
                      hourlyLimit,
                      connectedInboxesCount: 2,
                      inboxesList: [],
                      isCampaignActive: campaignStatus === "ACTIVE",
                      userTimezone,
                    }
                  );
                  setDiagnosticStep(diag);
                  setIsDiagnosticOpen(true);
                }
              }
            }}
          />

          <Badge 
            variant="default" 
            className={`shadow-sm font-bold ${
              campaignStatus === "PAUSED" 
                ? "bg-amber-500 hover:bg-amber-600 text-white" 
                : "bg-emerald-500 hover:bg-emerald-600 text-white"
            }`}
          >
            {campaignStatus === "PAUSED" ? "⏸️ PAUSED" : "🟢 ACTIVE"}
          </Badge>
        </div>
      </div>

      {/* Progress & Stats */}
      <Card className="border-border shadow-sm overflow-hidden">
        <CardContent className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="space-y-1 border-r border-border/50 pr-4">
              <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Send className="h-4 w-4" /> Sent
              </p>
              {isLoading && liveItems.length === 0 ? (
                <div className="h-9 w-12 bg-muted/60 animate-pulse rounded my-1" />
              ) : (
                <p className="text-3xl font-bold">{stats.sent}</p>
              )}
            </div>
            <div className="space-y-1 border-r border-border/50 pr-4">
              <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <MailOpen className="h-4 w-4 text-blue-500" /> Opened
              </p>
              {isLoading && liveItems.length === 0 ? (
                <div className="h-9 w-12 bg-muted/60 animate-pulse rounded my-1" />
              ) : (
                <p className="text-3xl font-bold">{stats.opened}</p>
              )}
            </div>
            <div className="space-y-1 border-r border-border/50 pr-4">
              <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Reply className="h-4 w-4 text-emerald-500" /> Replied
              </p>
              {isLoading && liveItems.length === 0 ? (
                <div className="h-9 w-12 bg-muted/60 animate-pulse rounded my-1" />
              ) : (
                <p className="text-3xl font-bold text-emerald-600">{stats.replied}</p>
              )}
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-500" /> Failed
              </p>
              {isLoading && liveItems.length === 0 ? (
                <div className="h-9 w-12 bg-muted/60 animate-pulse rounded my-1" />
              ) : (
                <p className="text-3xl font-bold">{stats.bounced}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Table */}
      <Card className="border-border shadow-md flex flex-col overflow-hidden h-[600px] bg-background">
        <CardHeader className="bg-muted/10 border-b border-border py-4">
          <CardTitle className="text-base font-semibold flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Live Email Delivery Status
            </div>
            <span className="text-xs font-medium text-muted-foreground bg-background px-3 py-1.5 rounded-full border border-border shadow-sm">
              Click any row to view the lead&apos;s full journey
            </span>
          </CardTitle>
        </CardHeader>
        <ScrollArea className="flex-1">
          <Table>
            <TableHeader className="bg-muted/20 sticky top-0 z-10 shadow-sm backdrop-blur-md">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[30%] py-4 font-semibold">Recipient</TableHead>
                <TableHead className="w-[15%] py-4 font-semibold">Email Step</TableHead>
                <TableHead className="w-[20%] py-4 font-semibold">Scheduled Time</TableHead>
                <TableHead className="w-[15%] py-4 font-semibold">Live Status</TableHead>
                <TableHead className="w-[15%] py-4 font-semibold text-right">Event Time</TableHead>
                <TableHead className="w-[5%] py-4 text-center"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-border/50">
              {isLoading && liveItems.length === 0 ? (
                [1, 2, 3, 4].map((i) => (
                  <TableRow key={`skeleton-${i}`}>
                    <TableCell className="py-4 pl-4">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-muted/60 animate-pulse" />
                        <div className="h-4 w-48 bg-muted/60 rounded animate-pulse" />
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="h-5 w-16 bg-muted/60 rounded animate-pulse" />
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="h-4 w-32 bg-muted/60 rounded animate-pulse" />
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="h-6 w-24 bg-muted/60 rounded-full animate-pulse" />
                    </TableCell>
                    <TableCell className="py-4 text-right">
                      <div className="h-4 w-12 bg-muted/60 rounded animate-pulse ml-auto" />
                    </TableCell>
                    <TableCell className="py-4" />
                  </TableRow>
                ))
              ) : liveItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center h-40 text-muted-foreground flex flex-col items-center justify-center space-y-3">
                    <Activity className="h-10 w-10 text-muted-foreground/30" />
                    <span className="font-medium">No valid emails scheduled in this campaign.</span>
                  </TableCell>
                </TableRow>
              ) : (
                liveItems.map((item, idx) => (
                  <TableRow
                    key={item.queueId + idx}
                    onClick={() => openLeadJourney(item.recipientEmail)}
                    className={`hover:bg-muted/40 transition-all duration-200 cursor-pointer group relative ${item.isNew ? 'bg-emerald-50/30' : ''
                      }`}
                  >
                    <TableCell className="font-medium py-3 relative">
                      {item.isNew && (
                        <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-emerald-500 rounded-r-md shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                      )}
                      <div className="flex items-center gap-3 pl-2">
                        <Avatar className={`h-8 w-8 ring-1 shadow-sm transition-all ${item.isNew
                            ? 'ring-emerald-200 bg-emerald-100/50'
                            : 'ring-border group-hover:ring-primary/30'
                          }`}>
                          <AvatarFallback className={`text-xs font-semibold ${item.isNew ? 'text-emerald-700 bg-emerald-100/50' : 'bg-primary/5 text-primary'
                            }`}>
                            {item.recipientEmail.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="truncate max-w-[220px]" title={item.recipientEmail}>
                          {item.recipientEmail}
                        </span>
                        {item.isNew && (
                          <Badge variant="outline" className="ml-2 bg-emerald-50 text-emerald-600 border-emerald-200 shadow-sm text-[10px] uppercase font-semibold px-2 py-0 h-5">
                            Just Added
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-3">
                      <Badge variant="outline" className="text-[10px] font-medium shadow-none bg-muted/20 text-muted-foreground group-hover:bg-background group-hover:text-foreground transition-colors">
                        Email {item.sequenceStep.stepNumber}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm font-mono py-3">
                      {item.scheduledDate} <span className="mx-1.5 text-border">•</span> {item.scheduledTime}
                    </TableCell>
                    <TableCell className="py-3">
                      {getStatusBadge(item.liveStatus, item)}
                    </TableCell>
                    <TableCell className="text-right text-xs font-mono text-muted-foreground py-3 whitespace-nowrap">
                      {item.liveStatus === "SCHEDULED" ? "—" : formatEventTime(item.lastEventTime)}
                    </TableCell>
                    <TableCell className="text-center py-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                          <Button variant="ghost" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100 data-[state=open]:opacity-100">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 shadow-lg">
                          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Actions
                          </div>
                          <DropdownMenuItem
                            onClick={(e) => handleSendNow(e, item.queueId)}
                            disabled={item.liveStatus !== "SCHEDULED"}
                            className="cursor-pointer"
                          >
                            <Play className="h-4 w-4 mr-2 text-emerald-500" />
                            Send Now
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => openReschedule(e, item)}
                            disabled={item.liveStatus !== "SCHEDULED"}
                            className="cursor-pointer"
                          >
                            <Clock className="h-4 w-4 mr-2 text-primary" /> Reschedule
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={(e) => handleDeleteItem(e, item.queueId)}
                            className="cursor-pointer text-red-600 focus:text-red-700 focus:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4 mr-2" /> Delete Item
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </Card>

      {/* Reschedule Dialog */}
      <Dialog open={!!rescheduleItem} onOpenChange={(open) => !open && setRescheduleItem(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Reschedule Email</DialogTitle>
            <DialogDescription>
              Change the scheduled date and time for <span className="font-semibold text-foreground">{rescheduleItem?.recipientEmail}</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="date" className="text-right">
                Date
              </Label>
              <Input
                id="date"
                type="date"
                value={rescheduleDate}
                onChange={(e) => setRescheduleDate(e.target.value)}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="time" className="text-right">
                Time
              </Label>
              <Input
                id="time"
                type="time"
                value={rescheduleTime}
                onChange={(e) => setRescheduleTime(e.target.value)}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRescheduleItem(null)}>Cancel</Button>
            <Button onClick={handleSaveReschedule}>Save Schedule</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lead Journey Side Panel */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="w-[400px] sm:w-[540px] border-l border-border p-0 flex flex-col shadow-2xl">
          <SheetHeader className="p-6 border-b border-border bg-muted/10">
            <SheetTitle className="flex items-center gap-2 text-xl">
              <User className="h-5 w-5 text-primary" />
              Lead Journey
            </SheetTitle>
            <SheetDescription className="text-sm font-medium text-foreground mt-2 truncate">
              {selectedLead}
            </SheetDescription>
          </SheetHeader>

          <ScrollArea className="flex-1 p-6">
            <div className="space-y-8 relative pb-8">
              {/* Vertical connecting line for micro-timeline */}
              <div className="absolute left-6 top-4 bottom-8 w-px bg-slate-200" />

              {selectedLeadItems.map((item, idx) => {
                const step = item.sequenceStep.stepNumber;
                let delayStr = "";

                if (idx === 0) {
                  delayStr = "Today";
                } else {
                  const firstDate = parseISO(selectedLeadItems[0].scheduledDate);
                  const thisDate = parseISO(item.scheduledDate);
                  const diff = Math.max(0, differenceInDays(thisDate, firstDate));
                  delayStr = diff > 0 ? `+${diff} Days` : "Same Day";
                }

                const exactDate = format(parseISO(item.scheduledDate), "MMM do");

                return (
                  <div key={item.queueId} className="relative pl-10 group">
                    {/* Step Marker */}
                    <div className="absolute left-[20px] top-1.5 h-2.5 w-2.5 rounded-full bg-indigo-500 ring-4 ring-background shadow-sm z-10" />

                    <div className="flex flex-col space-y-2 pb-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span className="font-semibold text-slate-900 text-[13px] tracking-tight">
                            {step === 1 ? "Initial Email" : `Follow-up ${step - 1}`}
                          </span>
                          <span className="text-[11px] font-medium text-slate-400 bg-slate-100/50 px-2 py-0.5 rounded-full">
                            {delayStr}
                          </span>
                        </div>
                        <div className="scale-[0.85] origin-right">
                          {getStatusBadge(item.liveStatus, item)}
                        </div>
                      </div>

                      <div className="bg-slate-50/50 rounded-xl p-3.5 text-[13px] text-slate-600 border border-slate-100 leading-relaxed shadow-sm hover:shadow transition-shadow">
                        {item.sequenceStep.content}
                      </div>

                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 pt-1 font-medium">
                        {item.liveStatus === "SCHEDULED" ? (
                          <>
                            <CalendarIcon className="h-3 w-3" />
                            Scheduled for {exactDate} at {item.scheduledTime}
                          </>
                        ) : (
                          <>
                            <Activity className="h-3 w-3" />
                            <span className="capitalize">{item.liveStatus.toLowerCase()}</span> • {formatEventTime(item.lastEventTime)}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {selectedLeadItems.length > 0 && (
                <div className="relative pl-10 pt-2">
                  <div className="absolute left-[20px] top-4 h-2.5 w-2.5 rounded-full bg-slate-200 ring-4 ring-background z-10" />
                  <span className="text-[13px] font-medium text-slate-400 tracking-tight">Journey Ends</span>
                </div>
              )}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Resume Confirmation Dialog for Overdue Emails */}
      <ResumeConfirmationModal
        isOpen={isResumeModalOpen}
        onOpenChange={setIsResumeModalOpen}
        overdueItems={overdueItemsForResume}
        onConfirmResume={() => executeTogglePause("RESUME")}
        isResuming={isResumingCampaign}
      />

      {/* 1-Click Forensic Diagnostic & Capacity Sentinel Modal (SILAER 10X) */}
      <WhyNotSentModal
        diagnostic={diagnosticStep}
        isOpen={isDiagnosticOpen}
        onClose={() => {
          setIsDiagnosticOpen(false);
          setDiagnosticStep(null);
        }}
      />
    </div>
  );
}
