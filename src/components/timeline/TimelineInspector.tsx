"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { useTimelineData } from "@/hooks/useTimelineData";
import { TimelineEmailItem } from "@/app/api/timeline/route";
import { TimelineDetailDrawer } from "./TimelineDetailDrawer";
import {
  Search,
  RefreshCw,
  Download,
  Check,
  Send,
  Eye,
  MessageSquareReply,
  AlertCircle,
  Zap,
  Radio,
  Inbox,
  ArrowUpRight,
  X,
  Clock,
  Sparkles,
  Layers,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

// Smart Component to highlight and bold matching query text
function HighlightMatch({ text, query }: { text: string | null | undefined; query: string }) {
  if (!text) return <span>—</span>;
  if (!query || !query.trim()) return <>{text}</>;

  const q = query.trim();
  try {
    const escaped = q.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
    const regex = new RegExp(`(${escaped})`, "gi");
    const parts = text.split(regex);
    return (
      <>
        {parts.map((part, i) =>
          part.toLowerCase() === q.toLowerCase() ? (
            <mark
              key={i}
              className="bg-amber-200 dark:bg-amber-500/40 text-slate-950 dark:text-amber-100 font-bold px-0.5 rounded-xs shadow-xs"
            >
              {part}
            </mark>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </>
    );
  } catch {
    return <>{text}</>;
  }
}

// Avatar color palette for lead identity
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

export function TimelineInspector() {
  const {
    items,
    stats,
    isLoading,
    isValidating,
    statusFilter,
    setStatusFilter,
    timeRange,
    setTimeRange,
    isLiveSync,
    toggleLiveSync,
    refreshNow,
  } = useTimelineData();

  const [localSearch, setLocalSearch] = useState("");
  const [selectedItem, setSelectedItem] = useState<TimelineEmailItem | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut listener (/ or Ctrl+K / Cmd+K to search)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && document.activeElement !== searchInputRef.current)) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Category item counts for tab badges
  const categoryCounts = useMemo(() => {
    return {
      ALL: items.length,
      OPENED: items.filter((i) => i.lifecycle.opened.status === "COMPLETED").length,
      REPLIED: items.filter((i) => i.lifecycle.replied.status === "COMPLETED").length,
      SENT: items.filter((i) => i.lifecycle.sent.status === "COMPLETED").length,
      FAILED: items.filter((i) => i.overallStatus === "FAILED" || i.overallStatus === "BOUNCED").length,
    };
  }, [items]);

  // Instant 0ms Client-Side Filter
  const filteredItems = useMemo(() => {
    let list = items;
    if (statusFilter !== "ALL") {
      list = list.filter((item) => {
        if (statusFilter === "OPENED") return item.lifecycle.opened.status === "COMPLETED";
        if (statusFilter === "REPLIED") return item.lifecycle.replied.status === "COMPLETED";
        if (statusFilter === "SENT") return item.lifecycle.sent.status === "COMPLETED";
        if (statusFilter === "FAILED") return item.overallStatus === "FAILED" || item.overallStatus === "BOUNCED";
        return true;
      });
    }

    if (!localSearch || !localSearch.trim()) return list;
    const q = localSearch.toLowerCase().trim();
    return list.filter((item) => {
      const matchEmail = item.recipientEmail.toLowerCase().includes(q);
      const matchName = item.recipientName?.toLowerCase().includes(q);
      const matchSender = item.senderEmail.toLowerCase().includes(q);
      const matchSubject = item.subject.toLowerCase().includes(q);
      const matchMsgId = item.gmailMessageId?.toLowerCase().includes(q);
      const matchStatus = item.overallStatus.toLowerCase().includes(q);
      return matchEmail || matchName || matchSender || matchSubject || matchMsgId || matchStatus;
    });
  }, [items, localSearch, statusFilter]);

  const handleRowClick = (item: TimelineEmailItem) => {
    setSelectedItem(item);
    setIsDrawerOpen(true);
  };

  const exportToCSV = () => {
    if (filteredItems.length === 0) {
      toast.error("No records to export");
      return;
    }

    const headers = [
      "Recipient Email",
      "Recipient Name",
      "Sender Inbox",
      "Subject",
      "Step Number",
      "Overall Status",
      "Created At",
      "Scheduled At",
      "Sent At",
      "Gmail Accepted",
      "Delivery Speed (ms)",
      "Opened",
      "Open Count",
      "First Opened At",
      "Time To Open (ms)",
      "Replied",
      "Replied At",
      "Gmail Message ID",
      "Error Message",
    ];

    const rows = filteredItems.map((i) => [
      `"${i.recipientEmail}"`,
      `"${i.recipientName || ""}"`,
      `"${i.senderEmail}"`,
      `"${i.subject.replace(/"/g, '""')}"`,
      i.stepNumber,
      i.overallStatus,
      i.lifecycle.created.at,
      i.lifecycle.scheduled.at,
      i.lifecycle.sent.at || "",
      i.lifecycle.gmailAccepted.status,
      i.lifecycle.gmailAccepted.latencyMs ?? "",
      i.lifecycle.opened.status,
      i.lifecycle.opened.count,
      i.lifecycle.opened.firstAt || "",
      i.lifecycle.opened.latencyMs ?? "",
      i.lifecycle.replied.status,
      i.lifecycle.replied.at || "",
      `"${i.gmailMessageId || ""}"`,
      `"${(i.errorMessage || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `outreach_timeline_${new Date().toISOString().split("T")[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV Export Complete", {
      description: `Downloaded ${filteredItems.length} email records.`,
    });
  };

  const formatCleanTime = (isoString: string | null | undefined) => {
    if (!isoString) return "—";
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true });
  };

  const formatCleanDate = (isoString: string | null | undefined) => {
    if (!isoString) return "—";
    const d = new Date(isoString);
    const month = d.toLocaleString([], { month: "short" });
    const day = d.getDate();
    const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true });
    return `${month} ${day}, ${time}`;
  };

  const formatLatencyClean = (ms: number | null | undefined) => {
    if (ms === null || ms === undefined) return "—";
    if (ms < 1000) return `+${ms}ms`;
    return `+${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <div className="space-y-4 max-w-full">
      {/* 1. Harmonious Enterprise Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Total Sent */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-200 flex items-center justify-between group">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Total Sent
            </div>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-mono tracking-tight">
                {stats.totalSent}
              </span>
              <span className="text-[11px] text-slate-400 font-medium">dispatches</span>
            </div>
          </div>
          <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center border border-slate-200/70 dark:border-slate-700/70 group-hover:scale-105 transition-transform">
            <Send className="h-4 w-4" />
          </div>
        </div>

        {/* Opened */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md hover:border-purple-300 dark:hover:border-purple-700 transition-all duration-200 flex items-center justify-between group">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Opened
            </div>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-mono tracking-tight">
                {stats.totalOpened}
              </span>
              <span className="text-[11px] text-purple-600 dark:text-purple-400 font-bold">
                {stats.openRate}%
              </span>
            </div>
          </div>
          <div className="h-10 w-10 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-200/80 group-hover:scale-105 transition-transform">
            <Eye className="h-4 w-4" />
          </div>
        </div>

        {/* Replied */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md hover:border-emerald-300 dark:hover:border-emerald-700 transition-all duration-200 flex items-center justify-between group">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Replied
            </div>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-mono tracking-tight">
                {stats.totalReplied}
              </span>
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
                {stats.replyRate}%
              </span>
            </div>
          </div>
          <div className="h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200/80 group-hover:scale-105 transition-transform">
            <MessageSquareReply className="h-4 w-4" />
          </div>
        </div>

        {/* Failed */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md hover:border-rose-300 dark:hover:border-rose-700 transition-all duration-200 flex items-center justify-between group">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Failed
            </div>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-mono tracking-tight">
                {stats.totalFailed}
              </span>
              <span className="text-[11px] text-rose-500 font-medium">bounces</span>
            </div>
          </div>
          <div className="h-10 w-10 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-200/80 group-hover:scale-105 transition-transform">
            <AlertCircle className="h-4 w-4" />
          </div>
        </div>

        {/* Avg Delivery Speed */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md hover:border-amber-300 dark:hover:border-amber-700 transition-all duration-200 flex items-center justify-between col-span-2 lg:col-span-1 group">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Avg Delivery Speed
            </div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-mono mt-1 tracking-tight">
              {stats.avgLatencyMs < 1000 ? `+${stats.avgLatencyMs}ms` : `+${(stats.avgLatencyMs / 1000).toFixed(1)}s`}
            </div>
          </div>
          <div className="h-10 w-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-200/80 group-hover:scale-105 transition-transform">
            <Zap className="h-4 w-4" />
          </div>
        </div>
      </div>

      {/* 2. Sleek Controls & Category Counter Tabs */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Instant Search Bar */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            name="timeline_instant_search_input"
            id="timeline_instant_search_input"
            autoComplete="off"
            autoCorrect="off"
            spellCheck="false"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Search email, name, subject, or message ID... (Press / to search)"
            className="w-full pl-10 pr-14 py-2.5 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 dark:focus:border-orange-400 transition-all shadow-xs h-10"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {localSearch ? (
              <button
                onClick={() => setLocalSearch("")}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                title="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : (
              <kbd className="hidden sm:inline-block text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700">
                /
              </kbd>
            )}
          </div>
        </div>

        {/* Status Category Tabs with Dynamic Item Counters */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex bg-white dark:bg-slate-900 p-1 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs text-xs gap-1">
            {(["ALL", "OPENED", "REPLIED", "SENT", "FAILED"] as const).map((tab) => {
              const count = categoryCounts[tab];
              const isActive = statusFilter === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setStatusFilter(tab)}
                  className={`px-3 py-1.5 rounded-xl font-bold text-[11px] flex items-center gap-1.5 transition-all ${
                    isActive
                      ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <span>{tab === "ALL" ? "All" : tab.charAt(0) + tab.slice(1).toLowerCase()}</span>
                  <span
                    className={`text-[10px] px-1 py-0.2 rounded-full ${
                      isActive
                        ? "bg-slate-700 text-white dark:bg-slate-200 dark:text-slate-900"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Time Range Filter */}
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-700 dark:text-slate-300 focus:outline-none shadow-xs cursor-pointer"
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="7d">Last 7d</option>
            <option value="30d">Last 30d</option>
          </select>

          {/* Live Sync Status */}
          <button
            onClick={toggleLiveSync}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium border shadow-xs transition-all ${
              isLiveSync
                ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white"
                : "bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-800"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${isLiveSync ? "bg-emerald-400 animate-pulse" : "bg-slate-400"}`} />
            <span className="text-[11px]">{isLiveSync ? "Live" : "Paused"}</span>
          </button>

          {/* Refresh */}
          <button
            onClick={refreshNow}
            disabled={isValidating}
            className="p-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white shadow-xs transition-all disabled:opacity-50"
            title="Refresh stream"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isValidating ? "animate-spin text-orange-500" : ""}`} />
          </button>

          {/* CSV Export */}
          <button
            onClick={exportToCSV}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 shadow-xs transition-all"
          >
            <Download className="h-3 w-3" />
            <span className="text-[11px] font-semibold">Export CSV</span>
          </button>
        </div>
      </div>

      {/* 3. Professional Spreadsheet Table with Sticky Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto max-h-[640px] overflow-y-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 z-10 bg-slate-50/95 dark:bg-slate-950/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold text-[11px] uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4 font-semibold">Recipient</th>
                <th className="py-3 px-3 font-semibold">Sender Account</th>
                <th className="py-3 px-3 font-semibold">Step & Subject</th>
                <th className="py-3 px-3 font-semibold text-center">Scheduled</th>
                <th className="py-3 px-3 font-semibold text-center">Sent</th>
                <th
                  className="py-3 px-3 font-semibold text-center"
                  title="Time taken by Gmail servers to process and confirm delivery"
                >
                  Delivery Speed
                </th>
                <th className="py-3 px-3 font-semibold text-center">Opened</th>
                <th className="py-3 px-3 font-semibold text-center">Replied</th>
                <th className="py-3 px-4 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {isLoading ? (
                // 5 Beautiful Skeleton Rows
                Array.from({ length: 6 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="h-6 w-6 rounded-md bg-slate-200 dark:bg-slate-800" />
                        <div className="space-y-1.5 flex-1">
                          <div className="h-3 w-36 bg-slate-200 dark:bg-slate-800 rounded" />
                          <div className="h-2 w-20 bg-slate-100 dark:bg-slate-800/60 rounded" />
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="h-3 w-28 bg-slate-200 dark:bg-slate-800 rounded" />
                    </td>
                    <td className="py-3 px-3">
                      <div className="h-3 w-40 bg-slate-200 dark:bg-slate-800 rounded" />
                    </td>
                    <td className="py-3 px-3 text-center">
                      <div className="h-3 w-16 bg-slate-100 dark:bg-slate-800 rounded mx-auto" />
                    </td>
                    <td className="py-3 px-3 text-center">
                      <div className="h-5 w-16 bg-slate-100 dark:bg-slate-800 rounded-md mx-auto" />
                    </td>
                    <td className="py-3 px-3 text-center">
                      <div className="h-4 w-12 bg-slate-100 dark:bg-slate-800 rounded mx-auto" />
                    </td>
                    <td className="py-3 px-3 text-center">
                      <div className="h-4 w-10 bg-slate-100 dark:bg-slate-800 rounded mx-auto" />
                    </td>
                    <td className="py-3 px-3 text-center">
                      <div className="h-4 w-10 bg-slate-100 dark:bg-slate-800 rounded mx-auto" />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="h-4 w-12 bg-slate-200 dark:bg-slate-800 rounded ml-auto" />
                    </td>
                  </tr>
                ))
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-slate-400">
                    <Inbox className="h-8 w-8 mx-auto text-slate-300 dark:text-slate-700 mb-2" />
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      {localSearch ? `No matches found for "${localSearch}"` : "No email records in this view"}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {localSearch ? "Try adjusting your search terms or filter criteria." : "Dispatched sequence emails will appear here live."}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const isSent = item.lifecycle.sent.status === "COMPLETED";
                  const isAccepted = item.lifecycle.gmailAccepted.status === "COMPLETED";
                  const isFailed = item.overallStatus === "FAILED" || item.overallStatus === "BOUNCED";
                  const isOpened = item.lifecycle.opened.status === "COMPLETED";
                  const isReplied = item.lifecycle.replied.status === "COMPLETED";

                  const avatarStyle = getAvatarColor(item.recipientEmail);

                  return (
                    <tr
                      key={item.id}
                      onClick={() => handleRowClick(item)}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 cursor-pointer transition-colors group"
                    >
                      {/* Recipient */}
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`h-6 w-6 rounded-md font-bold text-[10px] flex items-center justify-center shrink-0 border ${avatarStyle}`}
                          >
                            {item.recipientName
                              ? item.recipientName.charAt(0).toUpperCase()
                              : item.recipientEmail.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <span className="font-semibold text-slate-900 dark:text-white truncate block">
                              <HighlightMatch text={item.recipientEmail} query={localSearch} />
                            </span>
                            {item.recipientName && (
                              <span className="text-[10px] text-slate-400 block truncate">
                                <HighlightMatch text={item.recipientName} query={localSearch} />
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Sender Inbox */}
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 dark:text-slate-400 truncate max-w-[160px]">
                        <HighlightMatch text={item.senderEmail} query={localSearch} />
                      </td>

                      {/* Step & Subject */}
                      <td className="py-2.5 px-3 max-w-xs">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 shrink-0 border border-slate-200/50 dark:border-slate-700/50">
                            Step {item.stepNumber}
                          </span>
                          <span className="text-slate-800 dark:text-slate-200 truncate" title={item.subject}>
                            <HighlightMatch text={item.subject} query={localSearch} />
                          </span>
                        </div>
                      </td>

                      {/* Scheduled */}
                      <td className="py-2.5 px-3 text-center text-slate-500 dark:text-slate-400 font-mono text-[11px] whitespace-nowrap">
                        {formatCleanDate(item.lifecycle.scheduled.at)}
                      </td>

                      {/* Sent */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        {isSent ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-[11px] border border-slate-200/60 dark:border-slate-700/60 shadow-2xs">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            <span>{formatCleanTime(item.lifecycle.sent.at)}</span>
                          </span>
                        ) : isFailed ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-medium text-[11px] border border-rose-200/60 dark:border-rose-900/60">
                            Failed
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600 font-bold">—</span>
                        )}
                      </td>

                      {/* Delivery Speed (Gmail Server Confirmation) */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        {isAccepted ? (
                          <span
                            title="Time taken by Gmail servers to process and confirm delivery"
                            className="inline-flex items-center gap-1 font-mono text-[11px] text-slate-600 dark:text-slate-400 bg-slate-100/70 dark:bg-slate-800/70 px-1.5 py-0.5 rounded border border-slate-200/50 dark:border-slate-700/50 shadow-2xs"
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            <span>{formatLatencyClean(item.lifecycle.gmailAccepted.latencyMs)}</span>
                          </span>
                        ) : isFailed ? (
                          <span className="text-rose-500 font-bold">✕</span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600 font-bold">—</span>
                        )}
                      </td>

                      {/* Opened */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        {isOpened ? (
                          <span
                            title={item.lifecycle.opened.firstAt ? `First opened: ${formatCleanDate(item.lifecycle.opened.firstAt)}` : undefined}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold text-[11px] border border-indigo-200/60 dark:border-indigo-800/60 shadow-2xs"
                          >
                            <Check className="h-3 w-3 text-indigo-600 dark:text-indigo-400" />
                            <span>
                              {item.lifecycle.opened.count} {item.lifecycle.opened.count === 1 ? "open" : "opens"}
                            </span>
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600 font-bold">—</span>
                        )}
                      </td>

                      {/* Replied */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        {isReplied ? (
                          <span
                            title={item.lifecycle.replied.at ? `Replied at: ${formatCleanDate(item.lifecycle.replied.at)}` : undefined}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-semibold text-[11px] border border-emerald-200/60 dark:border-emerald-800/60 shadow-2xs"
                          >
                            <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                            <span>Replied</span>
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600 font-bold">—</span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-2.5 px-4 text-right whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white font-medium text-[11px] group-hover:bg-slate-100 dark:group-hover:bg-slate-800 transition-colors">
                          <span>Inspect</span>
                          <ArrowUpRight className="h-3 w-3 text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200" />
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Bar */}
        <div className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
          <div>
            Showing <strong className="text-slate-800 dark:text-slate-200">{filteredItems.length}</strong> of {items.length} records
            {localSearch && (
              <span className="ml-1 text-orange-600 dark:text-orange-400 font-medium">
                (filtered by &quot;{localSearch}&quot;)
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span>Live Telemetry Stream Active</span>
            </span>
          </div>
        </div>
      </div>

      {/* Detail Slide-Over Forensics Drawer */}
      <TimelineDetailDrawer
        item={selectedItem}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onRefresh={refreshNow}
      />
    </div>
  );
}
