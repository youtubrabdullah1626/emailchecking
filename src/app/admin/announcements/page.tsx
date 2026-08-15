"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PageHeader } from "@/components/ui/page-header";
import { AnimatedPage } from "@/components/ui/animated";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
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
import { 
  Megaphone, 
  Trash2, 
  Rocket, 
  AlertTriangle, 
  Info, 
  Send, 
  Clock, 
  EyeOff, 
  Eye, 
  Calendar, 
  CalendarRange, 
  Sparkles, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  RefreshCw, 
  ExternalLink,
  Zap,
  Timer
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow, isAfter, isBefore, addDays, addHours } from "date-fns";

// Helper to format Date to local YYYY-MM-DDTHH:mm for datetime-local inputs
const toLocalInputString = (date: Date) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

export default function AnnouncementsAdminPage() {
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPublishing, setIsPublishing] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [announcementToDelete, setAnnouncementToDelete] = useState<{ id: string; title: string } | null>(null);

  const deleteTimers = useRef<Record<string, NodeJS.Timeout>>({});
  const deletedAnnouncementsRef = useRef<Record<string, any>>({});

  // Form State
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState("INFO");
  const [link, setLink] = useState("");
  const [buttonText, setButtonText] = useState("");

  // Scheduling State
  const [scheduleMode, setScheduleMode] = useState<"immediate" | "scheduled">("immediate");
  const [hasExpiration, setHasExpiration] = useState(false);
  
  // Default scheduled start: today at current hour + 1
  const [startDateStr, setStartDateStr] = useState(() => {
    const nextHour = new Date();
    nextHour.setMinutes(0, 0, 0);
    nextHour.setHours(nextHour.getHours() + 1);
    return toLocalInputString(nextHour);
  });

  // Default expiration: 3 days from now
  const [endDateStr, setEndDateStr] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    d.setHours(23, 59, 0, 0);
    return toLocalInputString(d);
  });

  // History Filter & Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"ALL" | "LIVE" | "SCHEDULED" | "EXPIRED" | "HIDDEN">("ALL");

  const fetchAnnouncements = async () => {
    try {
      const res = await fetch("/api/admin/announcements");
      const data = await res.json();
      setAnnouncements(data.announcements || []);
    } catch (e) {
      toast.error("Failed to load announcements");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  // Quick Preset Handlers
  const applyPreset = (preset: "24h" | "48h" | "7d" | "weekend") => {
    const now = new Date();
    if (preset === "24h") {
      setScheduleMode("scheduled");
      setStartDateStr(toLocalInputString(now));
      setEndDateStr(toLocalInputString(addHours(now, 24)));
      setHasExpiration(true);
      toast.info("Preset applied: Next 24 Hours");
    } else if (preset === "48h") {
      setScheduleMode("scheduled");
      setStartDateStr(toLocalInputString(now));
      setEndDateStr(toLocalInputString(addHours(now, 48)));
      setHasExpiration(true);
      toast.info("Preset applied: Next 48 Hours");
    } else if (preset === "7d") {
      setScheduleMode("scheduled");
      setStartDateStr(toLocalInputString(now));
      setEndDateStr(toLocalInputString(addDays(now, 7)));
      setHasExpiration(true);
      toast.info("Preset applied: Next 7 Days");
    } else if (preset === "weekend") {
      const sat = new Date();
      const day = sat.getDay();
      const diff = (6 - day + 7) % 7 || 7; // days until next Saturday
      sat.setDate(sat.getDate() + diff);
      sat.setHours(0, 0, 0, 0);
      
      const sun = new Date(sat);
      sun.setDate(sun.getDate() + 1);
      sun.setHours(23, 59, 0, 0);

      setScheduleMode("scheduled");
      setStartDateStr(toLocalInputString(sat));
      setEndDateStr(toLocalInputString(sun));
      setHasExpiration(true);
      toast.info("Preset applied: Next Weekend Campaign");
    }
  };

  // Compute validation and human readable timing
  const scheduleAnalysis = useMemo(() => {
    const now = new Date();
    let scheduledAt: Date | null = null;
    let expiresAt: Date | null = null;

    if (scheduleMode === "scheduled") {
      scheduledAt = startDateStr ? new Date(startDateStr) : now;
      expiresAt = (hasExpiration || endDateStr) ? new Date(endDateStr) : null;
    } else {
      scheduledAt = now;
      expiresAt = hasExpiration && endDateStr ? new Date(endDateStr) : null;
    }

    const isStartValid = scheduledAt && !isNaN(scheduledAt.getTime());
    const isEndValid = !expiresAt || !isNaN(expiresAt.getTime());
    const isOrderValid = !expiresAt || (isStartValid && expiresAt > scheduledAt);

    const isFutureScheduled = scheduledAt && scheduledAt > now;

    return {
      scheduledAt,
      expiresAt,
      isStartValid,
      isEndValid,
      isOrderValid,
      isFutureScheduled,
      isValid: isStartValid && isEndValid && isOrderValid
    };
  }, [scheduleMode, hasExpiration, startDateStr, endDateStr]);

  const handlePublish = async () => {
    if (!title.trim() || !message.trim()) {
      toast.error("Title and message are required.");
      return;
    }

    if (!scheduleAnalysis.isValid) {
      if (!scheduleAnalysis.isOrderValid) {
        toast.error("The expiration date must be after the start date.");
      } else {
        toast.error("Please enter valid dates.");
      }
      return;
    }
    
    setIsPublishing(true);
    try {
      const payload = {
        title: title.trim(),
        message: message.trim(),
        type,
        link: link.trim() || null,
        buttonText: buttonText.trim() || null,
        scheduledAt: scheduleAnalysis.scheduledAt ? scheduleAnalysis.scheduledAt.toISOString() : new Date().toISOString(),
        expiresAt: scheduleAnalysis.expiresAt ? scheduleAnalysis.expiresAt.toISOString() : null,
        isActive: true
      };

      const res = await fetch("/api/admin/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to publish");
      }
      
      const successMsg = scheduleAnalysis.isFutureScheduled
        ? `Announcement scheduled for ${format(scheduleAnalysis.scheduledAt!, "MMM d, yyyy 'at' h:mm a")} 📅`
        : "Announcement published live to all users! 🚀";

      toast.success(successMsg);
      setTitle("");
      setMessage("");
      setLink("");
      setButtonText("");
      fetchAnnouncements();
    } catch (e: any) {
      toast.error(e.message || "Error publishing announcement.");
    } finally {
      setIsPublishing(false);
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    setAnnouncements(prev => prev.map(ann => ann.id === id ? { ...ann, isActive: !currentStatus } : ann));
    
    try {
      const res = await fetch(`/api/admin/announcements/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !currentStatus })
      });
      if (!res.ok) throw new Error();
      toast.success(currentStatus ? "Announcement hidden from users." : "Announcement is now active.");
      fetchAnnouncements();
    } catch (e) {
      setAnnouncements(prev => prev.map(ann => ann.id === id ? { ...ann, isActive: currentStatus } : ann));
      toast.error("Failed to update status");
    }
  };

  const handleGoLiveNow = async (id: string) => {
    setActionLoadingId(id);
    try {
      const res = await fetch(`/api/admin/announcements/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          scheduledAt: new Date().toISOString(),
          isActive: true 
        })
      });
      if (!res.ok) throw new Error();
      toast.success("Announcement is now pushed LIVE immediately! 🚀");
      fetchAnnouncements();
    } catch (e) {
      toast.error("Failed to push announcement live.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleExtend7Days = async (id: string, currentExpiresAt: string | null) => {
    setActionLoadingId(id);
    try {
      const base = currentExpiresAt && new Date(currentExpiresAt) > new Date() 
        ? new Date(currentExpiresAt) 
        : new Date();
      const newExpiry = addDays(base, 7);

      const res = await fetch(`/api/admin/announcements/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          expiresAt: newExpiry.toISOString(),
          isActive: true 
        })
      });
      if (!res.ok) throw new Error();
      toast.success(`Extended campaign until ${format(newExpiry, "MMM d, yyyy")}! ⏳`);
      fetchAnnouncements();
    } catch (e) {
      toast.error("Failed to extend announcement.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const confirmDeleteAnnouncement = () => {
    if (!announcementToDelete) return;
    const { id, title } = announcementToDelete;

    // 1. Close dialog immediately (0ms)
    setAnnouncementToDelete(null);

    // 2. Cache the announcement object for instant restoration
    const targetAnn = announcements.find(a => a.id === id);
    if (targetAnn) {
      deletedAnnouncementsRef.current[id] = targetAnn;
    }

    // 3. Clear any existing timer
    if (deleteTimers.current[id]) {
      clearTimeout(deleteTimers.current[id]);
    }

    // 4. Immediately remove from state (0ms delay!)
    setAnnouncements(prev => prev.filter(ann => ann.id !== id));

    // 5. Set 6-second grace timer before permanent server deletion
    const timer = setTimeout(async () => {
      delete deleteTimers.current[id];
      delete deletedAnnouncementsRef.current[id];
      try {
        const res = await fetch(`/api/admin/announcements/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error();
      } catch (e) {
        toast.error("Failed to delete announcement on server");
      }
    }, 6000);

    deleteTimers.current[id] = timer;

    // 6. Show instant toast with Undo
    toast.success(`Announcement deleted`, {
      description: title ? `"${title}"` : undefined,
      action: {
        label: "Undo",
        onClick: () => {
          // Cancel server deletion immediately!
          if (deleteTimers.current[id]) {
            clearTimeout(deleteTimers.current[id]);
            delete deleteTimers.current[id];
          }

          const restored = deletedAnnouncementsRef.current[id];
          delete deletedAnnouncementsRef.current[id];

          if (restored) {
            setAnnouncements(prev => {
              if (prev.some(a => a.id === id)) return prev;
              return [restored, ...prev];
            });
          }
          toast.info("Announcement restored");
        }
      },
      duration: 5500
    });
  };

  const getTypeIcon = (t: string) => {
    switch (t.toUpperCase()) {
      case "FEATURE": return <Rocket className="h-4 w-4 text-purple-500" />;
      case "WARNING": return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      default: return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  // Helper to compute lifecycle state of an announcement item
  const getAnnouncementStatus = (ann: any) => {
    const now = new Date();
    const start = new Date(ann.scheduledAt || ann.createdAt);
    const end = ann.expiresAt ? new Date(ann.expiresAt) : null;

    if (!ann.isActive) {
      return { key: "HIDDEN", label: "Hidden / Inactive", color: "bg-muted text-muted-foreground border-border" };
    }
    if (end && end <= now) {
      return { key: "EXPIRED", label: "Expired", color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30" };
    }
    if (start > now) {
      return { key: "SCHEDULED", label: "Scheduled", color: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30" };
    }
    return { key: "LIVE", label: "Live Now", color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" };
  };

  // Filter announcements for history view
  const filteredAnnouncements = useMemo(() => {
    return announcements.filter(ann => {
      const status = getAnnouncementStatus(ann);

      if (activeTab === "LIVE" && status.key !== "LIVE") return false;
      if (activeTab === "SCHEDULED" && status.key !== "SCHEDULED") return false;
      if (activeTab === "EXPIRED" && status.key !== "EXPIRED") return false;
      if (activeTab === "HIDDEN" && status.key !== "HIDDEN") return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = ann.title?.toLowerCase().includes(q);
        const matchesMsg = ann.message?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesMsg) return false;
      }

      return true;
    });
  }, [announcements, activeTab, searchQuery]);

  // Counts for tabs
  const counts = useMemo(() => {
    const res = { ALL: announcements.length, LIVE: 0, SCHEDULED: 0, EXPIRED: 0, HIDDEN: 0 };
    announcements.forEach(ann => {
      const st = getAnnouncementStatus(ann);
      if (st.key === "LIVE") res.LIVE++;
      else if (st.key === "SCHEDULED") res.SCHEDULED++;
      else if (st.key === "EXPIRED") res.EXPIRED++;
      else if (st.key === "HIDDEN") res.HIDDEN++;
    });
    return res;
  }, [announcements]);

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Signature Silaer Warm Header Banner */}
      <div className="bg-gradient-to-r from-orange-100/70 via-amber-50/60 to-white dark:from-slate-900 dark:via-slate-900 dark:to-slate-800/80 border border-orange-200/80 dark:border-orange-950/40 rounded-2xl p-5 md:p-6 shadow-xs relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start sm:items-center gap-4">
            <div className="h-11 w-11 rounded-full bg-orange-100 dark:bg-orange-950/70 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0 border border-orange-200/80 dark:border-orange-800/50 shadow-xs">
              <Megaphone className="h-5 w-5" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                  Broadcasting & Notification Studio
                </h1>
              </div>
              <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                Create, schedule, and broadcast in-app announcements across all user workspaces.
              </p>
            </div>
          </div>
        </div>
      </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* LEFT: Composer & Scheduler */}
          <div className="lg:col-span-5 space-y-6">
            <Card className="border-border shadow-md overflow-hidden bg-gradient-to-b from-card to-background">
              <div className="bg-primary/5 p-4 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-primary/20 p-2 rounded-md text-primary">
                    <Megaphone className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Draft Announcement</h3>
                    <p className="text-xs text-muted-foreground">
                      {scheduleMode === "immediate" 
                        ? "Goes live instantly upon publishing" 
                        : "Scheduled to run within a custom date window"}
                    </p>
                  </div>
                </div>

                <Badge 
                  variant="outline" 
                  className={cn(
                    "text-xs font-semibold px-2.5 py-1",
                    scheduleMode === "immediate" 
                      ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" 
                      : "bg-purple-500/10 text-purple-600 border-purple-500/30"
                  )}
                >
                  {scheduleMode === "immediate" ? "⚡ Live Now" : "📅 Scheduled"}
                </Badge>
              </div>

              <CardContent className="p-6 space-y-5">
                {/* 1. Announcement Type */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Announcement Type</label>
                  <Select value={type} onValueChange={setType}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FEATURE">
                        <div className="flex items-center gap-2">
                          <Rocket className="h-4 w-4 text-purple-500" /> Feature Launch
                        </div>
                      </SelectItem>
                      <SelectItem value="INFO">
                        <div className="flex items-center gap-2">
                          <Info className="h-4 w-4 text-blue-500" /> General Info & News
                        </div>
                      </SelectItem>
                      <SelectItem value="WARNING">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-orange-500" /> Maintenance / Alert
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* 2. Headline / Title */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Headline / Title</label>
                  <Input 
                    placeholder="e.g. 🚀 Spring Feature Drop & System Maintenance" 
                    value={title} 
                    onChange={e => setTitle(e.target.value)} 
                    className="font-medium"
                  />
                </div>

                {/* 3. Message Body */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Message Body</label>
                  <Textarea 
                    placeholder="Explain the update, promotion, or notice to your active users..." 
                    className="min-h-[100px] resize-none leading-relaxed"
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                  />
                </div>

                {/* 4. Optional Call to Action */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">CTA Link (Optional)</label>
                    <Input 
                      placeholder="https://..." 
                      value={link} 
                      onChange={e => setLink(e.target.value)} 
                      className="h-9 text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Button Label (Optional)</label>
                    <Input 
                      placeholder="e.g. Learn More" 
                      value={buttonText} 
                      onChange={e => setButtonText(e.target.value)} 
                      className="h-9 text-xs"
                    />
                  </div>
                </div>

                {/* 5. SMART SCHEDULING SECTION */}
                <div className="pt-3 border-t border-border space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CalendarRange className="h-4 w-4 text-primary" />
                      <span className="text-sm font-semibold text-foreground">Schedule & Date Window</span>
                    </div>

                    <div className="flex bg-muted p-0.5 rounded-lg border border-border">
                      <button
                        type="button"
                        onClick={() => setScheduleMode("immediate")}
                        className={cn(
                          "px-2.5 py-1 text-xs font-medium rounded-md transition-all",
                          scheduleMode === "immediate" 
                            ? "bg-card text-foreground shadow-sm" 
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        ⚡ Immediate
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setScheduleMode("scheduled");
                          setHasExpiration(true);
                        }}
                        className={cn(
                          "px-2.5 py-1 text-xs font-medium rounded-md transition-all",
                          scheduleMode === "scheduled" 
                            ? "bg-card text-foreground shadow-sm" 
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        📅 Date Range
                      </button>
                    </div>
                  </div>

                  {/* Preset Quick Chips */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[11px] font-medium text-muted-foreground mr-1">Quick Presets:</span>
                    <button
                      type="button"
                      onClick={() => applyPreset("24h")}
                      className="px-2 py-0.5 text-[11px] rounded bg-muted/60 hover:bg-muted text-foreground border border-border transition-colors"
                    >
                      24 Hours
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset("48h")}
                      className="px-2 py-0.5 text-[11px] rounded bg-muted/60 hover:bg-muted text-foreground border border-border transition-colors"
                    >
                      48 Hours
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset("7d")}
                      className="px-2 py-0.5 text-[11px] rounded bg-muted/60 hover:bg-muted text-foreground border border-border transition-colors"
                    >
                      7 Days
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset("weekend")}
                      className="px-2 py-0.5 text-[11px] rounded bg-muted/60 hover:bg-muted text-foreground border border-border transition-colors"
                    >
                      Next Weekend
                    </button>
                  </div>

                  {/* Schedule Controls */}
                  {scheduleMode === "scheduled" ? (
                    <div className="p-3.5 rounded-lg border border-purple-500/20 bg-purple-500/5 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* FROM (Start Date) */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-purple-500" />
                            <span>From (Start Date)</span>
                          </label>
                          <Input 
                            type="datetime-local" 
                            value={startDateStr}
                            onChange={e => setStartDateStr(e.target.value)}
                            className="text-xs bg-card font-mono"
                          />
                        </div>

                        {/* TO (End Date) */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-purple-500" />
                            <span>To (End Date / Expiration)</span>
                          </label>
                          <Input 
                            type="datetime-local" 
                            value={endDateStr}
                            onChange={e => setEndDateStr(e.target.value)}
                            className="text-xs bg-card font-mono"
                          />
                        </div>
                      </div>

                      <p className="text-[11px] text-muted-foreground">
                        Users will only see this announcement between the start and end dates.
                      </p>
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-lg border border-border bg-muted/20 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Timer className="h-4 w-4 text-muted-foreground" />
                          <span className="text-xs font-medium text-foreground">Auto-Expire Announcement</span>
                        </div>
                        <Switch 
                          checked={hasExpiration} 
                          onCheckedChange={setHasExpiration} 
                        />
                      </div>

                      {hasExpiration && (
                        <div className="pt-2 space-y-1.5 animate-in fade-in duration-200">
                          <label className="text-xs font-medium text-muted-foreground">
                            Expire & Hide Automatically On:
                          </label>
                          <Input 
                            type="datetime-local" 
                            value={endDateStr}
                            onChange={e => setEndDateStr(e.target.value)}
                            className="text-xs bg-card font-mono"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Live Schedule Summary Box */}
                  <div className={cn(
                    "p-3 rounded-md border text-xs flex items-start gap-2.5",
                    !scheduleAnalysis.isValid 
                      ? "bg-destructive/10 border-destructive/30 text-destructive"
                      : scheduleAnalysis.isFutureScheduled
                        ? "bg-purple-500/10 border-purple-500/20 text-purple-700 dark:text-purple-300"
                        : "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                  )}>
                    {!scheduleAnalysis.isValid ? (
                      <>
                        <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-destructive" />
                        <div>
                          <span className="font-semibold block">Invalid Schedule Range</span>
                          {!scheduleAnalysis.isOrderValid 
                            ? "End date must be set to a time AFTER the start date." 
                            : "Please provide valid dates."}
                        </div>
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 flex-shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold block">
                            {scheduleAnalysis.isFutureScheduled 
                              ? "Scheduled Broadcast Preview" 
                              : "Live Broadcast Preview"}
                          </span>
                          <p className="mt-0.5 leading-normal">
                            {scheduleAnalysis.isFutureScheduled 
                              ? `Will go live on ${format(scheduleAnalysis.scheduledAt!, "MMM d, yyyy 'at' h:mm a")}` 
                              : "Will go live immediately"}
                            {scheduleAnalysis.expiresAt ? (
                              <> and automatically end on <strong>{format(scheduleAnalysis.expiresAt, "MMM d, yyyy 'at' h:mm a")}</strong>.</>
                            ) : (
                              <> and remain active indefinitely until manually paused.</>
                            )}
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Submit Button */}
                <Button 
                  onClick={handlePublish} 
                  disabled={isPublishing || !title.trim() || !message.trim() || !scheduleAnalysis.isValid} 
                  className={cn(
                    "w-full h-11 text-base font-semibold shadow-sm transition-all hover:scale-[1.01]",
                    scheduleAnalysis.isFutureScheduled && "bg-purple-600 hover:bg-purple-700 text-white"
                  )}
                >
                  {isPublishing ? (
                    "Publishing Announcement..."
                  ) : scheduleAnalysis.isFutureScheduled ? (
                    <>
                      <Calendar className="mr-2 h-4 w-4" /> 
                      Schedule for {format(scheduleAnalysis.scheduledAt!, "MMM d, yyyy")}
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" /> 
                      Publish Live Now
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* RIGHT: Broadcast & Schedule History Hub */}
          <div className="lg:col-span-7 space-y-4">
            <Card className="border-border shadow-sm h-full flex flex-col">
              <CardHeader className="border-b border-border bg-muted/20 pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Clock className="h-5 w-5 text-muted-foreground" /> 
                      Broadcast & Schedule History
                    </CardTitle>
                    <CardDescription>Manage your active, scheduled, and past global notifications.</CardDescription>
                  </div>

                  <div className="relative w-full sm:w-56">
                    <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
                    <Input 
                      placeholder="Search history..." 
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="pl-8 h-9 text-xs"
                    />
                  </div>
                </div>

                {/* Filter Tabs */}
                <div className="flex flex-wrap items-center gap-1.5 pt-3">
                  <button
                    onClick={() => setActiveTab("ALL")}
                    className={cn(
                      "px-3 py-1 text-xs font-medium rounded-full border transition-all",
                      activeTab === "ALL" 
                        ? "bg-primary text-primary-foreground border-primary" 
                        : "bg-card text-muted-foreground border-border hover:bg-muted"
                    )}
                  >
                    All ({counts.ALL})
                  </button>
                  <button
                    onClick={() => setActiveTab("LIVE")}
                    className={cn(
                      "px-3 py-1 text-xs font-medium rounded-full border transition-all flex items-center gap-1.5",
                      activeTab === "LIVE" 
                        ? "bg-emerald-500 text-white border-emerald-500" 
                        : "bg-card text-emerald-600 dark:text-emerald-400 border-border hover:bg-emerald-500/10"
                    )}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Live Now ({counts.LIVE})
                  </button>
                  <button
                    onClick={() => setActiveTab("SCHEDULED")}
                    className={cn(
                      "px-3 py-1 text-xs font-medium rounded-full border transition-all flex items-center gap-1.5",
                      activeTab === "SCHEDULED" 
                        ? "bg-purple-600 text-white border-purple-600" 
                        : "bg-card text-purple-600 dark:text-purple-400 border-border hover:bg-purple-500/10"
                    )}
                  >
                    <Calendar className="h-3 w-3" />
                    Scheduled ({counts.SCHEDULED})
                  </button>
                  <button
                    onClick={() => setActiveTab("EXPIRED")}
                    className={cn(
                      "px-3 py-1 text-xs font-medium rounded-full border transition-all flex items-center gap-1.5",
                      activeTab === "EXPIRED" 
                        ? "bg-amber-600 text-white border-amber-600" 
                        : "bg-card text-amber-600 dark:text-amber-400 border-border hover:bg-amber-500/10"
                    )}
                  >
                    <Clock className="h-3 w-3" />
                    Expired ({counts.EXPIRED})
                  </button>
                  <button
                    onClick={() => setActiveTab("HIDDEN")}
                    className={cn(
                      "px-3 py-1 text-xs font-medium rounded-full border transition-all",
                      activeTab === "HIDDEN" 
                        ? "bg-muted-foreground text-white border-muted-foreground" 
                        : "bg-card text-muted-foreground border-border hover:bg-muted"
                    )}
                  >
                    Hidden ({counts.HIDDEN})
                  </button>
                </div>
              </CardHeader>

              <CardContent className="p-0 flex-1">
                {isLoading ? (
                  <div className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center gap-2">
                    <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground opacity-50" />
                    <span>Loading broadcasting hub...</span>
                  </div>
                ) : filteredAnnouncements.length === 0 ? (
                  <div className="p-12 text-center flex flex-col items-center justify-center border-dashed border-2 border-border/50 mx-6 my-8 rounded-lg">
                    <Megaphone className="h-10 w-10 text-muted-foreground mb-3 opacity-20" />
                    <h3 className="text-lg font-medium text-foreground">No announcements match</h3>
                    <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                      {searchQuery 
                        ? `No broadcasts found matching "${searchQuery}".` 
                        : activeTab !== "ALL" 
                          ? `There are currently no ${activeTab.toLowerCase()} announcements.`
                          : "Your published and scheduled announcements will appear here."}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    <AnimatePresence initial={false}>
                      {filteredAnnouncements.map((ann) => {
                        const status = getAnnouncementStatus(ann);
                        const start = new Date(ann.scheduledAt || ann.createdAt);
                        const end = ann.expiresAt ? new Date(ann.expiresAt) : null;
                        const isActing = actionLoadingId === ann.id;

                        return (
                          <motion.div 
                            key={ann.id} 
                            layout
                            initial={{ opacity: 0, scale: 0.98, y: -6 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ 
                              opacity: 0, 
                              scale: 0.96, 
                              x: -24, 
                              transition: { duration: 0.22, ease: "easeOut" } 
                            }}
                            transition={{ 
                              type: "spring", 
                              stiffness: 450, 
                              damping: 32, 
                              mass: 0.8 
                            }}
                            className={cn(
                              "p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4 transition-colors hover:bg-muted/10",
                              !ann.isActive && "opacity-60 grayscale-[40%]"
                            )}
                          >
                            {/* Announcement Info */}
                            <div className="flex gap-4 flex-1">
                              <div className="mt-1 bg-background border border-border shadow-sm h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0">
                                {getTypeIcon(ann.type)}
                              </div>
                              <div className="space-y-1.5 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h4 className="font-semibold text-foreground text-base leading-snug">
                                    {ann.title}
                                  </h4>
                                  <Badge variant="outline" className={cn("text-[10px] font-semibold px-2 py-0.5 border", status.color)}>
                                    {status.label}
                                  </Badge>
                                </div>

                                <p className="text-sm text-muted-foreground leading-relaxed">
                                  {ann.message}
                                </p>
                                
                                {/* CTA Link preview if present */}
                                {ann.link && (
                                  <div className="pt-1">
                                    <a 
                                      href={ann.link} 
                                      target="_blank" 
                                      rel="noreferrer" 
                                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
                                    >
                                      <ExternalLink className="h-3 w-3" />
                                      {ann.buttonText || "Call to Action Link"} ({ann.link})
                                    </a>
                                  </div>
                                )}

                                {/* Schedule Window Badge Info */}
                                <div className="pt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium text-muted-foreground">
                                  <div className="flex items-center gap-1.5">
                                    <CalendarRange className="h-3.5 w-3.5 text-primary" />
                                    <span>
                                      From: <strong>{format(start, "MMM d, yyyy")}</strong> ({format(start, "h:mm a")})
                                    </span>
                                  </div>

                                  <span className="text-muted-foreground/40 hidden sm:inline">→</span>

                                  <div className="flex items-center gap-1.5">
                                    <Clock className="h-3.5 w-3.5 text-primary" />
                                    <span>
                                      To: <strong>{end ? `${format(end, "MMM d, yyyy")} (${format(end, "h:mm a")})` : "Indefinite"}</strong>
                                    </span>
                                  </div>

                                  {status.key === "SCHEDULED" && (
                                    <span className="text-purple-600 dark:text-purple-400 font-semibold bg-purple-500/10 px-2 py-0.5 rounded">
                                      Starts in {formatDistanceToNow(start)}
                                    </span>
                                  )}

                                  {status.key === "LIVE" && end && (
                                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded">
                                      Ends in {formatDistanceToNow(end)}
                                    </span>
                                  )}

                                  {status.key === "EXPIRED" && end && (
                                    <span className="text-amber-600 dark:text-amber-400 font-medium">
                                      Ended {formatDistanceToNow(end, { addSuffix: true })}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Quick Actions Bar */}
                            <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2.5 flex-shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border">
                              <div className="flex items-center gap-2">
                                {/* 1-Click Smart Action: Go Live Now if scheduled */}
                                {status.key === "SCHEDULED" && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={isActing}
                                    onClick={() => handleGoLiveNow(ann.id)}
                                    className="h-8 text-xs font-semibold bg-purple-500/10 hover:bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-500/30 gap-1.5"
                                  >
                                    <Zap className="h-3.5 w-3.5 text-purple-500" />
                                    Go Live Now
                                  </Button>
                                )}

                                {/* 1-Click Smart Action: Extend +7 days if expired */}
                                {status.key === "EXPIRED" && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={isActing}
                                    onClick={() => handleExtend7Days(ann.id, ann.expiresAt)}
                                    className="h-8 text-xs font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30 gap-1.5"
                                  >
                                    <RefreshCw className="h-3.5 w-3.5 text-amber-500" />
                                    +7 Days
                                  </Button>
                                )}

                                <div className="flex items-center gap-1.5 text-sm text-muted-foreground ml-1">
                                  {ann.isActive ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                                  <Switch 
                                    checked={ann.isActive} 
                                    onCheckedChange={() => handleToggleStatus(ann.id, ann.isActive)} 
                                  />
                                </div>
                              </div>

                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => setAnnouncementToDelete({ id: ann.id, title: ann.title })}
                                className="text-destructive hover:text-destructive hover:bg-destructive/10 h-7 px-2 text-xs cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                              </Button>
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          
        </div>

        <AlertDialog
          open={!!announcementToDelete}
          onOpenChange={(open) => !open && setAnnouncementToDelete(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader className="sm:flex-row sm:items-start gap-4 space-y-0 text-left">
              <div className="mx-auto sm:mx-0 h-12 w-12 rounded-2xl bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0 ring-8 ring-red-500/5">
                <AlertTriangle className="h-6 w-6 stroke-[2.2]" />
              </div>
              <div className="space-y-1.5 flex-1 text-center sm:text-left">
                <AlertDialogTitle className="text-lg font-bold text-foreground">
                  Delete Announcement
                </AlertDialogTitle>
                <AlertDialogDescription className="text-sm text-muted-foreground leading-relaxed">
                  Are you sure you want to delete <span className="font-semibold text-foreground">{announcementToDelete?.title}</span>? It will immediately stop displaying in user notification trays.
                </AlertDialogDescription>
              </div>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-2 sm:mt-0 gap-2.5">
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDeleteAnnouncement}
                className="bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-500/20"
              >
                Delete Announcement
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}
