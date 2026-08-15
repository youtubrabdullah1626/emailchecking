"use client";

import React, { useState } from "react";
import { useTimelineData } from "@/hooks/useTimelineData";
import { TimelineEmailItem } from "@/app/api/timeline/route";
import { TimelineDetailDrawer } from "./TimelineDetailDrawer";
import {
  Search,
  RefreshCw,
  Download,
  Check,
  X,
  Minus,
  Send,
  Eye,
  MessageSquareReply,
  AlertCircle,
  Zap,
  Radio,
  ChevronRight,
  Inbox,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

export function TimelineInspector() {
  const {
    items,
    stats,
    isLoading,
    isValidating,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    timeRange,
    setTimeRange,
    isLiveSync,
    toggleLiveSync,
    refreshNow,
  } = useTimelineData();

  const [selectedItem, setSelectedItem] = useState<TimelineEmailItem | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const handleRowClick = (item: TimelineEmailItem) => {
    setSelectedItem(item);
    setIsDrawerOpen(true);
  };

  const exportToCSV = () => {
    if (items.length === 0) {
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

    const rows = items.map((i) => [
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
      description: `Downloaded ${items.length} records.`,
    });
  };

  const formatTimeOnly = (isoString: string | null | undefined) => {
    if (!isoString) return "—";
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatDateOnly = (isoString: string | null | undefined) => {
    if (!isoString) return "—";
    const d = new Date(isoString);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* 1. Ultra-Clean Minimalist KPI Header Strip */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-xl p-4 shadow-sm">
        <div className="grid grid-cols-2 sm:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 dark:divide-slate-800 gap-y-3 sm:gap-y-0">
          {/* Sent */}
          <div className="px-4 first:pl-2">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Send className="h-3 w-3 text-blue-500" />
              <span>Total Sent</span>
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-xl font-bold text-slate-900 dark:text-white font-mono">
                {stats.totalSent}
              </span>
              <span className="text-[11px] text-slate-400">emails</span>
            </div>
          </div>

          {/* Opened */}
          <div className="px-4">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Eye className="h-3 w-3 text-purple-500" />
              <span>Opened</span>
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-xl font-bold text-slate-900 dark:text-white font-mono">
                {stats.totalOpened}
              </span>
              <span className="text-xs font-semibold text-purple-600 dark:text-purple-400">
                ({stats.openRate}%)
              </span>
            </div>
          </div>

          {/* Replied */}
          <div className="px-4">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <MessageSquareReply className="h-3 w-3 text-emerald-500" />
              <span>Replied</span>
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-xl font-bold text-slate-900 dark:text-white font-mono">
                {stats.totalReplied}
              </span>
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                ({stats.replyRate}%)
              </span>
            </div>
          </div>

          {/* Failed */}
          <div className="px-4">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <AlertCircle className="h-3 w-3 text-rose-500" />
              <span>Failed</span>
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-xl font-bold text-slate-900 dark:text-white font-mono">
                {stats.totalFailed}
              </span>
              <span className="text-[11px] text-slate-400">issues</span>
            </div>
          </div>

          {/* Avg Latency */}
          <div className="px-4 last:pr-2 col-span-2 sm:col-span-1">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Zap className="h-3 w-3 text-amber-500" />
              <span>Avg Latency</span>
            </div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-xl font-bold text-slate-900 dark:text-white font-mono">
                +{stats.avgLatencyMs}
              </span>
              <span className="text-[11px] text-slate-400">ms</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Sleek Filter & Search Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search email, name, subject..."
            className="w-full pl-9 pr-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all shadow-sm"
          />
        </div>

        {/* Filter Tabs & Quick Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Segmented Filter */}
          <div className="inline-flex bg-slate-100 dark:bg-slate-900 p-0.5 rounded-lg border border-slate-200/80 dark:border-slate-800/80 text-xs">
            {["ALL", "OPENED", "REPLIED", "SENT", "FAILED"].map((tab) => (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={`px-2.5 py-1 rounded-md font-medium text-[11px] transition-all ${
                  statusFilter === tab
                    ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs font-semibold"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
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
            className="px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-700 dark:text-slate-300 focus:outline-none shadow-sm cursor-pointer"
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="7d">Last 7d</option>
            <option value="30d">Last 30d</option>
          </select>

          {/* Live Sync Toggle */}
          <button
            onClick={toggleLiveSync}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border shadow-sm transition-all ${
              isLiveSync
                ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/60 text-emerald-700 dark:text-emerald-300"
                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${isLiveSync ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} />
            <span className="text-[11px]">{isLiveSync ? "Live" : "Paused"}</span>
          </button>

          {/* Refresh */}
          <button
            onClick={refreshNow}
            disabled={isValidating}
            className="p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 shadow-sm transition-all disabled:opacity-50"
            title="Refresh stream"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isValidating ? "animate-spin text-orange-500" : ""}`} />
          </button>

          {/* CSV Export */}
          <button
            onClick={exportToCSV}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold hover:bg-slate-800 dark:hover:bg-slate-100 shadow-sm transition-all"
          >
            <Download className="h-3 w-3" />
            <span className="text-[11px]">CSV</span>
          </button>
        </div>
      </div>

      {/* 3. Clean, Lightweight Excel/Calendar Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/75 dark:bg-slate-950/60 border-b border-slate-200/80 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-medium text-[11px]">
                <th className="py-2.5 px-4">Recipient</th>
                <th className="py-2.5 px-3">Sender Inbox</th>
                <th className="py-2.5 px-3">Step & Subject</th>
                <th className="py-2.5 px-3 text-center">Scheduled</th>
                <th className="py-2.5 px-3 text-center">Sent</th>
                <th className="py-2.5 px-3 text-center">Accepted</th>
                <th className="py-2.5 px-3 text-center">Opened</th>
                <th className="py-2.5 px-3 text-center">Replied</th>
                <th className="py-2.5 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-400">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto text-orange-500 mb-1.5" />
                    <span className="text-xs">Loading email telemetry...</span>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-400">
                    <Inbox className="h-6 w-6 mx-auto text-slate-300 dark:text-slate-700 mb-1.5" />
                    <span className="text-xs">No records found.</span>
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const isSent = item.lifecycle.sent.status === "COMPLETED";
                  const isAccepted = item.lifecycle.gmailAccepted.status === "COMPLETED";
                  const isFailed = item.overallStatus === "FAILED" || item.overallStatus === "BOUNCED";
                  const isOpened = item.lifecycle.opened.status === "COMPLETED";
                  const isReplied = item.lifecycle.replied.status === "COMPLETED";

                  return (
                    <tr
                      key={item.id}
                      onClick={() => handleRowClick(item)}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 cursor-pointer transition-colors group"
                    >
                      {/* Recipient */}
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-900 dark:text-white">
                            {item.recipientEmail}
                          </span>
                          {item.recipientName && (
                            <span className="text-[10px] text-slate-400 hidden lg:inline">
                              ({item.recipientName})
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Sender Inbox */}
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 font-mono text-[11px] max-w-[150px] truncate">
                        {item.senderEmail}
                      </td>

                      {/* Subject */}
                      <td className="py-2.5 px-3 text-slate-800 dark:text-slate-200 max-w-xs truncate">
                        <span className="inline-block text-[10px] font-semibold px-1 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 mr-1.5">
                          S{item.stepNumber}
                        </span>
                        <span>{item.subject}</span>
                      </td>

                      {/* Scheduled */}
                      <td className="py-2.5 px-3 text-center text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                        {formatDateOnly(item.lifecycle.scheduled.at)}
                      </td>

                      {/* Sent */}
                      <td className="py-2.5 px-3 text-center">
                        {isSent ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-medium text-[11px]">
                            <Check className="h-3 w-3 text-emerald-600" />
                            <span>{formatTimeOnly(item.lifecycle.sent.at)}</span>
                          </span>
                        ) : isFailed ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 font-medium text-[11px]">
                            <X className="h-3 w-3 text-rose-600" />
                            <span>Failed</span>
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600 font-bold">—</span>
                        )}
                      </td>

                      {/* Gmail Accepted */}
                      <td className="py-2.5 px-3 text-center">
                        {isAccepted ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium text-[11px]">
                            <Check className="h-3 w-3" />
                            {item.lifecycle.gmailAccepted.latencyMs !== null && (
                              <span className="font-mono text-[10px] opacity-80">
                                +{item.lifecycle.gmailAccepted.latencyMs}ms
                              </span>
                            )}
                          </span>
                        ) : isFailed ? (
                          <span className="text-rose-500">
                            <X className="h-3.5 w-3.5 mx-auto" />
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600 font-bold">—</span>
                        )}
                      </td>

                      {/* Opened */}
                      <td className="py-2.5 px-3 text-center">
                        {isOpened ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 font-semibold text-[11px]">
                            <Check className="h-3 w-3 text-purple-600" />
                            <span>{item.lifecycle.opened.count}x</span>
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600 font-bold">—</span>
                        )}
                      </td>

                      {/* Replied */}
                      <td className="py-2.5 px-3 text-center">
                        {isReplied ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-semibold text-[11px]">
                            <Check className="h-3 w-3 text-emerald-600" />
                            <span>Replied</span>
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600 font-bold">—</span>
                        )}
                      </td>

                      {/* Details */}
                      <td className="py-2.5 px-4 text-right">
                        <span className="inline-flex items-center text-slate-400 group-hover:text-orange-500 font-medium text-[11px] transition-colors">
                          <span>Inspect</span>
                          <ChevronRight className="h-3 w-3 ml-0.5" />
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
        <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/40 flex items-center justify-between text-[11px] text-slate-400">
          <span>{items.length} records displayed</span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span>Auto-synced</span>
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
