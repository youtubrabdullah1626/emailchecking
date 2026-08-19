"use client";

import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import {
  Search,
  AlertCircle,
  PlayCircle,
  StopCircle,
  Send,
  Reply,
  MessageSquareReply,
  RefreshCw,
  Sparkles,
  Info,
  ExternalLink,
  X,
  CheckCircle2,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { format, formatDistanceToNow } from "date-fns";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const cleanSnippet = (text: string) => {
  if (!text) return { actualReply: "", quotedText: null };
  const clean = text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  const quoteRegex = /On\s+(?:Sun|Mon|Tue|Wed|Thu|Fri|Sat).*?wrote:/i;
  const match = clean.match(quoteRegex);

  if (match && match.index !== undefined) {
    const actualReply = clean.substring(0, match.index).trim();
    const quotedText = clean.substring(match.index).trim();
    return { actualReply, quotedText };
  }
  return { actualReply: clean, quotedText: null };
};

interface ReplyItem {
  id: string;
  replyTime: string;
  prospectId: string;
  prospectName: string;
  company: string;
  email: string;
  prospectStatus: string;
  sequenceId: string | null;
  sequenceStatus: string;
  stepNumber: number;
  subject: string;
  replyType: "REAL_REPLY" | "NEEDS_REVIEW" | "AUTO_REPLY" | "SPAM";
  confidence: number;
  reason: string;
  recommendedAction: string;
  actionTaken: string;
  reviewStatus: "PENDING" | "CONFIRMED_STOP" | "CONFIRMED_KEEP_ACTIVE" | "DISMISSED";
  rawSnippet: string;
  gmailThreadId: string;
  gmailMessageId: string;
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

export default function RepliesPage() {
  const [replies, setReplies] = useState<ReplyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"ALL" | "REAL_REPLY" | "NEEDS_REVIEW" | "AUTO_REPLY">("ALL");
  const [search, setSearch] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [selectedReply, setSelectedReply] = useState<ReplyItem | null>(null);
  const [actionProcessing, setActionProcessing] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [quickReplyText, setQuickReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);

  // Keyboard shortcut (/ or Ctrl+K to search)
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

  const handleSendQuickReply = async () => {
    if (!quickReplyText.trim() || !selectedReply) return;
    setSendingReply(true);
    try {
      const res = await fetch("/api/gmail/send-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: selectedReply.email,
          toName: selectedReply.prospectName,
          subject: `Re: ${selectedReply.subject.replace(/^Re:\s*/i, "")}`,
          content: quickReplyText,
          threadId: selectedReply.gmailThreadId,
          inReplyToMessageId: selectedReply.gmailMessageId,
          originalMessage: {
            date: new Date(selectedReply.replyTime).toLocaleString(),
            from: `${selectedReply.prospectName} <${selectedReply.email}>`,
            text: cleanSnippet(selectedReply.rawSnippet).actualReply,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send reply");

      toast.success("Reply sent successfully!");
      setQuickReplyText("");
      setSelectedReply(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send reply");
    } finally {
      setSendingReply(false);
    }
  };

  const loadReplies = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/replies");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to load replies.");
      }
      const data = await res.json();
      setReplies(data.replies ?? []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load replies.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReplies();
  }, [loadReplies]);

  const handleOperatorAction = async (reviewId: string, action: "CONFIRM_STOP" | "KEEP_ACTIVE" | "DISMISS") => {
    setActionProcessing(true);
    try {
      const res = await fetch("/api/replies/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewId, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.detail || "Action failed.");
      setSelectedReply(null);
      await loadReplies();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to execute action.");
    } finally {
      setActionProcessing(false);
    }
  };

  const handleScanReplies = async () => {
    setScanning(true);
    setScanResult(null);
    try {
      const res = await fetch("/api/replies/scan", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.error || "Scan failed.");

      const durationSec = ((data.durationMs ?? 0) / 1000).toFixed(1);
      const summaryText = `Scan completed in ${durationSec}s — Found ${data.realReplies ?? 0} real replies.`;

      setScanResult(summaryText);
      toast.success(summaryText);
      await loadReplies();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Scan failed.";
      setScanResult(`⚠️ ${msg}`);
      toast.error(msg);
    } finally {
      setScanning(false);
    }
  };

  const realCount = replies.filter((r) => r.replyType === "REAL_REPLY").length;
  const needsReviewCount = replies.filter((r) => r.replyType === "NEEDS_REVIEW" && r.reviewStatus === "PENDING").length;
  const autoCount = replies.filter((r) => r.replyType === "AUTO_REPLY" || r.replyType === "SPAM").length;

  const filteredReplies = useMemo(() => {
    return replies.filter((r) => {
      if (activeTab === "NEEDS_REVIEW") {
        if (r.replyType !== "NEEDS_REVIEW" || r.reviewStatus !== "PENDING") return false;
      } else if (activeTab === "REAL_REPLY") {
        if (r.replyType !== "REAL_REPLY") return false;
      } else if (activeTab === "AUTO_REPLY") {
        if (r.replyType !== "AUTO_REPLY" && r.replyType !== "SPAM") return false;
      }

      if (search && search.trim()) {
        const q = search.toLowerCase().trim();
        const matchName = r.prospectName?.toLowerCase().includes(q);
        const matchEmail = r.email?.toLowerCase().includes(q);
        const matchSubject = r.subject?.toLowerCase().includes(q);
        const matchCompany = r.company?.toLowerCase().includes(q);
        if (!matchName && !matchEmail && !matchSubject && !matchCompany) {
          return false;
        }
      }

      return true;
    });
  }, [replies, activeTab, search]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* 1. Dynamic Silaer Signature Header */}
      <div className="bg-card border border-border/80 rounded-xl p-6 shadow-xs relative overflow-hidden transition-colors duration-200">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start sm:items-center gap-4">
            <div className="h-11 w-11 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
              <MessageSquareReply className="h-5 w-5" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-bold text-foreground tracking-tight">
                  Inbox & Sentiment Center
                </h1>
                <TooltipProvider>
                  <Tooltip delayDuration={200}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="flex items-center justify-center h-5 w-5 rounded-full bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-help border border-border/80"
                      >
                        <Info className="h-3 w-3" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" align="center" className="max-w-xs p-3 bg-popover border border-border shadow-md rounded-lg z-50 text-xs">
                      <p className="font-semibold text-foreground mb-1">
                        AI Reply Intelligence
                      </p>
                      <p className="text-muted-foreground leading-relaxed">
                        Classifies prospect replies as real opportunities or auto-replies, and automatically halts future sequence follow-ups.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
                Review incoming prospect responses, sentiment tags, and auto-sequence stops.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 self-start md:self-center">
            <Button
              variant="outline"
              size="sm"
              onClick={loadReplies}
              disabled={loading || scanning}
              className="gap-1.5 text-xs h-9"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-muted-foreground ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>

            <Button
              size="sm"
              onClick={handleScanReplies}
              disabled={scanning || loading}
              className="gap-2 text-xs h-9 px-4"
            >
              <Sparkles className={`h-3.5 w-3.5 ${scanning ? "animate-spin" : ""}`} />
              <span>{scanning ? "Scanning Gmail..." : "Scan Gmail Now"}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* 2. Top Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {/* Real Replies */}
        <div
          onClick={() => setActiveTab("REAL_REPLY")}
          className={`bg-card border rounded-xl p-4 shadow-xs flex items-center justify-between cursor-pointer transition-all duration-150 ${
            activeTab === "REAL_REPLY"
              ? "border-emerald-500 ring-2 ring-emerald-500/10 bg-emerald-500/5"
              : "border-border/80 hover:border-border"
          }`}
        >
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Confirmed Real Replies
            </div>
            <div className="text-2xl font-extrabold text-foreground font-mono mt-0.5 tracking-tight">
              {realCount}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              Sequences stopped automatically
            </div>
          </div>
          <div className="h-9 w-9 rounded-lg bg-secondary text-foreground flex items-center justify-center border border-border/60">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
        </div>

        {/* Pending Reviews */}
        <div
          onClick={() => setActiveTab("NEEDS_REVIEW")}
          className={`bg-card border rounded-xl p-4 shadow-xs flex items-center justify-between cursor-pointer transition-all duration-150 ${
            activeTab === "NEEDS_REVIEW"
              ? "border-amber-500 ring-2 ring-amber-500/10 bg-amber-500/5"
              : "border-border/80 hover:border-border"
          }`}
        >
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Pending Reviews
            </div>
            <div className="text-2xl font-extrabold text-foreground font-mono mt-0.5 tracking-tight">
              {needsReviewCount}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              Ambiguous replies checked
            </div>
          </div>
          <div className="h-9 w-9 rounded-lg bg-secondary text-foreground flex items-center justify-center border border-border/60">
            <AlertCircle className="h-4 w-4 text-amber-500" />
          </div>
        </div>

        {/* Auto-Replies */}
        <div
          onClick={() => setActiveTab("AUTO_REPLY")}
          className={`bg-card border rounded-xl p-4 shadow-xs flex items-center justify-between cursor-pointer transition-all duration-150 ${
            activeTab === "AUTO_REPLY"
              ? "border-primary ring-2 ring-primary/10 bg-primary/5"
              : "border-border/80 hover:border-border"
          }`}
        >
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Auto-Replies / OOO
            </div>
            <div className="text-2xl font-extrabold text-foreground font-mono mt-0.5 tracking-tight">
              {autoCount}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              Automated responses filtered
            </div>
          </div>
          <div className="h-9 w-9 rounded-lg bg-secondary text-foreground flex items-center justify-center border border-border/60">
            <Reply className="h-4 w-4 text-primary" />
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
            placeholder="Search reply by lead, email, company, or subject... (Press / to search)"
            className="w-full pl-10 pr-12 py-2 bg-card border border-border/80 rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring transition-all shadow-2xs h-9"
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
              <kbd className="hidden sm:inline-block text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-secondary text-muted-foreground border border-border/80">
                /
              </kbd>
            )}
          </div>
        </div>

        {/* Filter Tabs with Live Item Counts */}
        <div className="inline-flex bg-secondary p-1 rounded-lg border border-border/80 shadow-2xs text-xs gap-1">
          {[
            { key: "ALL", label: "All", count: replies.length },
            { key: "REAL_REPLY", label: "Real Replies", count: realCount },
            { key: "NEEDS_REVIEW", label: "Needs Review", count: needsReviewCount },
            { key: "AUTO_REPLY", label: "Auto / OOO", count: autoCount },
          ].map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`px-3 py-1 rounded-md font-semibold text-xs flex items-center gap-1.5 transition-all ${
                  isActive
                    ? "bg-card text-foreground shadow-xs border border-border/60 font-bold"
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
      <div className="bg-card border border-border/80 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-secondary/50 border-b border-border/80 text-muted-foreground font-semibold text-[11px] uppercase tracking-wider sticky top-0 z-10">
              <TableRow className="border-border/80 hover:bg-transparent">
                <TableHead className="w-[300px] py-3 px-4 text-muted-foreground">Prospect</TableHead>
                <TableHead className="w-[180px] py-3 px-3 text-muted-foreground">Replied After</TableHead>
                <TableHead className="w-[160px] py-3 px-3 text-muted-foreground">Sentiment & Status</TableHead>
                <TableHead className="w-[160px] py-3 px-3 text-muted-foreground">Received</TableHead>
                <TableHead className="text-right w-[80px] py-3 px-4 text-muted-foreground">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-border/60">
              {loading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <TableRow key={idx}>
                    <TableCell><div className="h-10 w-48 bg-secondary/60 rounded animate-pulse" /></TableCell>
                    <TableCell><div className="h-4 w-32 bg-secondary/60 rounded animate-pulse" /></TableCell>
                    <TableCell><div className="h-6 w-24 bg-secondary/60 rounded-md animate-pulse" /></TableCell>
                    <TableCell><div className="h-4 w-24 bg-secondary/60 rounded animate-pulse" /></TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                ))
              ) : filteredReplies.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground text-xs">
                    {search ? `No replies match "${search}"` : "No replies in inbox view."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredReplies.map((item) => {
                  const avatarStyle = getAvatarColor(item.email || item.id);
                  const isPendingReview = item.replyType === "NEEDS_REVIEW" && item.reviewStatus === "PENDING";

                  return (
                    <TableRow
                      key={item.id}
                      onClick={() => setSelectedReply(item)}
                      className={`group cursor-pointer hover:bg-muted/40 transition-colors ${
                        isPendingReview ? "bg-amber-500/5" : ""
                      }`}
                    >
                      <TableCell className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`h-9 w-9 rounded-xl font-bold text-xs flex items-center justify-center shrink-0 border shadow-2xs ${avatarStyle}`}
                          >
                            {item.prospectName?.charAt(0).toUpperCase() || "P"}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-sm text-slate-900 dark:text-white group-hover:text-primary transition-colors truncate max-w-xs">
                              {item.prospectName}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-xs">
                              {item.company ? `${item.company} • ` : ""}
                              {item.email}
                            </div>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell className="py-3 px-3 text-xs text-slate-600 dark:text-slate-300">
                        {item.stepNumber === 1 ? "First Email" : `Follow-up #${item.stepNumber - 1}`}
                      </TableCell>

                      <TableCell className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          {item.replyType === "REAL_REPLY" ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-semibold text-[10px] border border-emerald-200/60">
                              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                              Real Reply
                            </span>
                          ) : item.replyType === "NEEDS_REVIEW" ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-semibold text-[10px] border border-amber-200/60">
                              <AlertCircle className="h-3 w-3 text-amber-600" />
                              Needs Review
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium text-[10px]">
                              Auto Reply
                            </span>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="py-3 px-3 text-xs text-slate-500 dark:text-slate-400">
                        <div>{format(new Date(item.replyTime), "MMM d, yyyy")}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {formatDistanceToNow(new Date(item.replyTime), { addSuffix: true })}
                        </div>
                      </TableCell>

                      <TableCell className="py-3 px-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2.5 text-slate-500 group-hover:text-primary text-xs font-semibold"
                        >
                          Review →
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Footer Bar */}
        <div className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex items-center justify-between text-[11px] text-slate-400">
          <span>
            Showing <strong className="text-slate-700 dark:text-slate-200">{filteredReplies.length}</strong> of {replies.length} replies
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span>AI Sentiment Engine Active</span>
          </span>
        </div>
      </div>

      {/* Selected Reply Drawer */}
      {selectedReply && (
        <Sheet open={!!selectedReply} onOpenChange={(open) => !open && !actionProcessing && setSelectedReply(null)}>
          <SheetContent className="w-[600px] sm:w-[600px] sm:max-w-none flex flex-col p-0 rounded-l-2xl">
            <SheetHeader className="p-6 border-b border-slate-200 dark:border-slate-800 space-y-3 bg-slate-50/50 dark:bg-slate-900/50">
              <div className="flex items-start justify-between">
                <div>
                  <SheetTitle className="text-xl font-bold text-slate-900 dark:text-white text-left">
                    {selectedReply.prospectName}
                  </SheetTitle>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2">
                    <span>{selectedReply.company || "Unknown Company"}</span>
                    <span>•</span>
                    <a href={`mailto:${selectedReply.email}`} className="hover:underline text-slate-800 dark:text-slate-200 font-medium">
                      {selectedReply.email}
                    </a>
                  </div>
                </div>
                <StatusBadge
                  status={
                    selectedReply.replyType === "REAL_REPLY"
                      ? "positive"
                      : selectedReply.replyType === "NEEDS_REVIEW"
                      ? "pending_review"
                      : "auto_reply"
                  }
                  label={
                    selectedReply.replyType === "REAL_REPLY"
                      ? "Real Reply"
                      : selectedReply.replyType === "NEEDS_REVIEW"
                      ? "Needs Review"
                      : "Auto Reply"
                  }
                />
              </div>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-slate-50/30 dark:bg-slate-950/30">
              <div className="flex flex-col items-start">
                <div className="flex items-center gap-2 mb-2 text-xs text-slate-400 font-mono">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{selectedReply.prospectName}</span>
                  <span>•</span>
                  <span>{formatDistanceToNow(new Date(selectedReply.replyTime), { addSuffix: true })}</span>
                </div>
                <div className="p-4 rounded-2xl max-w-[95%] text-xs leading-relaxed bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs rounded-tl-none whitespace-pre-wrap text-slate-800 dark:text-slate-200">
                  {(() => {
                    const { actualReply, quotedText } = cleanSnippet(selectedReply.rawSnippet);
                    return (
                      <>
                        <div className="font-sans">{actualReply || "No message content."}</div>
                        {quotedText && (
                          <details className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 cursor-pointer group">
                            <summary className="text-[10px] font-bold text-slate-400 uppercase tracking-wider group-hover:text-primary transition-colors">
                              Show Quoted Thread
                            </summary>
                            <div className="mt-2 text-xs text-slate-500 italic pl-3 border-l-2 border-slate-200 dark:border-slate-700">
                              {quotedText}
                            </div>
                          </details>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Quick Reply Box */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs p-4 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <Reply className="h-3.5 w-3.5 text-orange-500" />
                  <span>Send Direct Reply from Gmail</span>
                </h4>
                <Textarea
                  placeholder="Type your reply here..."
                  value={quickReplyText}
                  onChange={(e) => setQuickReplyText(e.target.value)}
                  className="min-h-[100px] text-xs bg-slate-50/50 dark:bg-slate-950 rounded-xl resize-none"
                />
                <div className="flex justify-end">
                  <Button
                    onClick={handleSendQuickReply}
                    disabled={sendingReply || !quickReplyText.trim()}
                    className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl text-xs"
                  >
                    {sendingReply ? "Sending..." : "Send Reply"} <Send className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              {selectedReply.replyType === "NEEDS_REVIEW" && selectedReply.reviewStatus === "PENDING" ? (
                <div className="flex items-center justify-between w-full">
                  <Button
                    disabled={actionProcessing}
                    onClick={() => handleOperatorAction(selectedReply.id, "DISMISS")}
                    variant="ghost"
                    size="sm"
                    className="text-slate-400 hover:text-slate-700"
                  >
                    Dismiss
                  </Button>
                  <div className="flex gap-2">
                    <Button
                      disabled={actionProcessing}
                      onClick={() => handleOperatorAction(selectedReply.id, "KEEP_ACTIVE")}
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-xs rounded-xl"
                    >
                      <PlayCircle className="h-3.5 w-3.5" /> Keep Active
                    </Button>
                    <Button
                      disabled={actionProcessing}
                      onClick={() => handleOperatorAction(selectedReply.id, "CONFIRM_STOP")}
                      size="sm"
                      className="gap-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs rounded-xl"
                    >
                      <StopCircle className="h-3.5 w-3.5" /> Stop Sequence
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex justify-end">
                  <Button onClick={() => setSelectedReply(null)} variant="outline" size="sm" className="rounded-xl text-xs">
                    Close
                  </Button>
                </div>
              )}
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
