"use client";

import React, { useState, useMemo } from "react";
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
  ChevronRight,
  Inbox,
  ArrowUpRight,
  X,
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

  // Instant 0ms Client-Side Filter on Top of Data
  const filteredItems = useMemo(() => {
    if (!localSearch || !localSearch.trim()) return items;
    const q = localSearch.toLowerCase().trim();
    return items.filter((item) => {
      const matchEmail = item.recipientEmail.toLowerCase().includes(q);
      const matchName = item.recipientName?.toLowerCase().includes(q);
      const matchSender = item.senderEmail.toLowerCase().includes(q);
      const matchSubject = item.subject.toLowerCase().includes(q);
      const matchMsgId = item.gmailMessageId?.toLowerCase().includes(q);
      const matchStatus = item.overallStatus.toLowerCase().includes(q);
      return matchEmail || matchName || matchSender || matchSubject || matchMsgId || matchStatus;
    });
  }, [items, localSearch]);

  const handleRowClick = (item: TimelineEmailItem) => {
    setSelectedItem(item);
    setIsDrawerOpen(true);
  };

  const exportToCSV = () => {
    if (filteredItems.length === 0) {
      toast.error("No data to export");
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
      "Dispatch Latency (ms)",
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
    toast.success("CSV Exported", {
      description: `Downloaded ${filteredItems.length} records.`,
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
      {/* 1. Harmonious SaaS KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Total Sent */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Sent
            </div>
            <div className="text-xl font-bold text-slate-900 dark:text-white font-mono mt-0.5">
              {stats.totalSent}
            </div>
          </div>
          <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center">
            <Send className="h-4 w-4" />
          </div>
        </div>

        {/* Opened */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Opened
            </div>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-bold text-slate-900 dark:text-white font-mono">
                {stats.totalOpened}
              </span>
              <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                {stats.openRate}%
              </span>
            </div>
          </div>
          <div className="h-8 w-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <Eye className="h-4 w-4" />
          </div>
        </div>

        {/* Replied */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Replied
            </div>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-bold text-slate-900 dark:text-white font-mono">
                {stats.totalReplied}
              </span>
              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                {stats.replyRate}%
              </span>
            </div>
          </div>
          <div className="h-8 w-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <MessageSquareReply className="h-4 w-4" />
          </div>
        </div>

        {/* Failed */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Failed
            </div>
            <div className="text-xl font-bold text-slate-900 dark:text-white font-mono mt-0.5">
              {stats.totalFailed}
            </div>
          </div>
          <div className="h-8 w-8 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center">
            <AlertCircle className="h-4 w-4" />
          </div>
        </div>

        {/* Avg Delivery Speed */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-xs flex items-center justify-between col-span-2 lg:col-span-1">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Avg Delivery Speed
            </div>
            <div className="text-xl font-bold text-slate-900 dark:text-white font-mono mt-0.5">
              {stats.avgLatencyMs < 1000 ? `+${stats.avgLatencyMs}ms` : `+${(stats.avgLatencyMs / 1000).toFixed(1)}s`}
            </div>
          </div>
          <div className="h-8 w-8 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <Zap className="h-4 w-4" />
          </div>
        </div>
      </div>

      {/* 2. Control Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        {/* Instant Search Bar (with autocomplete off and clear button) */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            name="timeline_filter_query_unique"
            id="timeline_filter_query_unique"
            autoComplete="off"
            autoCorrect="off"
            spellCheck="false"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Instant search email, name, subject..."
            className="w-full pl-9 pr-8 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-xs"
          />
          {localSearch && (
            <button
              onClick={() => setLocalSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              title="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Status Filter Tabs & Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Segmented Filter */}
          <div className="inline-flex bg-slate-100 dark:bg-slate-900 p-0.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs">
            {["ALL", "OPENED", "REPLIED", "SENT", "FAILED"].map((tab) => (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={`px-2.5 py-1 rounded-md font-medium text-[11px] transition-all ${
                  statusFilter === tab
                    ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs font-semibold"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
                }`}
              >
                {tab === "ALL" ? "All" : tab.charAt(0) + tab.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          {/* Time Range */}
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-700 dark:text-slate-300 focus:outline-none shadow-xs cursor-pointer"
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="7d">Last 7d</option>
            <option value="30d">Last 30d</option>
          </select>

          {/* Live Sync Status */}
          <button
            onClick={toggleLiveSync}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border shadow-xs transition-all ${
              isLiveSync
                ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white"
                : "bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-800"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${isLiveSync ? "bg-emerald-400 animate-pulse" : "bg-slate-400"}`} />
            <span className="text-[11px]">{isLiveSync ? "Live Stream" : "Paused"}</span>
          </button>

          {/* Refresh */}
          <button
            onClick={refreshNow}
            disabled={isValidating}
            className="p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white shadow-xs transition-all disabled:opacity-50"
            title="Refresh stream"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isValidating ? "animate-spin text-indigo-500" : ""}`} />
          </button>

          {/* CSV Export */}
          <button
            onClick={exportToCSV}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 shadow-xs transition-all"
          >
            <Download className="h-3 w-3" />
            <span className="text-[11px]">CSV</span>
          </button>
        </div>
      </div>

      {/* 3. Professional Spreadsheet Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/90 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold text-[11px] uppercase tracking-wider">
                <th className="py-3 px-4 font-semibold">Recipient</th>
                <th className="py-3 px-3 font-semibold">Sender Account</th>
                <th className="py-3 px-3 font-semibold">Step & Subject</th>
                <th className="py-3 px-3 font-semibold text-center">Scheduled</th>
                <th className="py-3 px-3 font-semibold text-center">Sent</th>
                <th className="py-3 px-3 font-semibold text-center" title="Time taken by Gmail servers to process and confirm delivery">Delivery Speed</th>
                <th className="py-3 px-3 font-semibold text-center">Opened</th>
                <th className="py-3 px-3 font-semibold text-center">Replied</th>
                <th className="py-3 px-4 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto text-indigo-500 mb-2" />
                    <span className="text-xs">Loading email timeline stream...</span>
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <Inbox className="h-6 w-6 mx-auto text-slate-300 dark:text-slate-700 mb-2" />
                    <span className="text-xs">
                      {localSearch ? `No email records match "${localSearch}".` : "No email records found."}
                    </span>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const isSent = item.lifecycle.sent.status === "COMPLETED";
                  const isAccepted = item.lifecycle.gmailAccepted.status === "COMPLETED";
                  const isFailed = item.overallStatus === "FAILED" || item.overallStatus === "BOUNCED";
                  const isOpened = item.lifecycle.opened.status === "COMPLETED";
                  const isReplied = item.lifecycle.replied.status === "COMPLETED";

                  return (
                    <tr
                      key={item.id}
                      onClick={() => handleRowClick(item)}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 cursor-pointer transition-colors group"
                    >
                      {/* Recipient (with HighlightMatch) */}
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-[10px] flex items-center justify-center shrink-0">
                            {item.recipientName ? item.recipientName.charAt(0).toUpperCase() : item.recipientEmail.charAt(0).toUpperCase()}
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

                      {/* Sender Inbox (with HighlightMatch) */}
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 dark:text-slate-400 truncate max-w-[160px]">
                        <HighlightMatch text={item.senderEmail} query={localSearch} />
                      </td>

                      {/* Step & Subject (with HighlightMatch) */}
                      <td className="py-2.5 px-3 max-w-xs">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 shrink-0">
                            Step {item.stepNumber}
                          </span>
                          <span className="text-slate-800 dark:text-slate-200 truncate">
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
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-[11px] border border-slate-200/60 dark:border-slate-700/60">
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
                            className="inline-flex items-center gap-1 font-mono text-[11px] text-slate-600 dark:text-slate-400 bg-slate-100/70 dark:bg-slate-800/70 px-1.5 py-0.5 rounded border border-slate-200/50 dark:border-slate-700/50"
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
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold text-[11px] border border-indigo-200/60 dark:border-indigo-800/60">
                            <Check className="h-3 w-3 text-indigo-600 dark:text-indigo-400" />
                            <span>{item.lifecycle.opened.count} {item.lifecycle.opened.count === 1 ? "open" : "opens"}</span>
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600 font-bold">—</span>
                        )}
                      </td>

                      {/* Replied */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        {isReplied ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-semibold text-[11px] border border-emerald-200/60 dark:border-emerald-800/60">
                            <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                            <span>Replied</span>
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600 font-bold">—</span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-2.5 px-4 text-right whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-slate-500 hover:text-slate-900 dark:hover:text-white font-medium text-[11px] group-hover:bg-slate-100 dark:group-hover:bg-slate-800 transition-colors">
                          <span>Inspect</span>
                          <ArrowUpRight className="h-3 w-3" />
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex items-center justify-between text-[11px] text-slate-400">
          <span>
            Showing <strong className="text-slate-700 dark:text-slate-200">{filteredItems.length}</strong> of {items.length} records
            {localSearch && <span className="ml-1 text-indigo-600 dark:text-indigo-400 font-medium">(filtered by &quot;{localSearch}&quot;)</span>}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span>Connected to Live Telemetry Stream</span>
          </span>
        </div>
      </div>

      {/* Slide-Over Drawer */}
      <TimelineDetailDrawer
        item={selectedItem}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onRefresh={refreshNow}
      />
    </div>
  );
}
