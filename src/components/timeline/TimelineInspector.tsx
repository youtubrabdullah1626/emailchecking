"use client";

import React, { useState } from "react";
import { useTimelineData } from "@/hooks/useTimelineData";
import { TimelineEmailItem } from "@/app/api/timeline/route";
import { TimelineDetailDrawer } from "./TimelineDetailDrawer";
import {
  Search,
  RefreshCw,
  Download,
  CheckCircle2,
  XCircle,
  Minus,
  Mail,
  Send,
  Eye,
  MessageSquareReply,
  AlertTriangle,
  Zap,
  Radio,
  Clock,
  ArrowUpDown,
  Filter,
  ExternalLink,
  ChevronRight,
  Inbox,
  User,
} from "lucide-react";
import { toast } from "sonner";

export function TimelineInspector() {
  const {
    items,
    pagination,
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
      `outreach_timeline_inspector_${new Date().toISOString().split("T")[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Spreadsheet Exported", {
      description: `Downloaded ${items.length} records to CSV.`,
    });
  };

  const formatShortTime = (isoString: string | null | undefined) => {
    if (!isoString) return "—";
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  const formatShortDate = (isoString: string | null | undefined) => {
    if (!isoString) return "—";
    const d = new Date(isoString);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  };

  return (
    <div className="space-y-6">
      {/* 1. Top Summary KPI Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* Total Sent */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Sent</span>
            <div className="h-7 w-7 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Send className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white font-mono">
              {stats.totalSent}
            </span>
            <span className="text-xs text-slate-400">dispatches</span>
          </div>
        </div>

        {/* Opened */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Opened</span>
            <div className="h-7 w-7 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Eye className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white font-mono">
              {stats.totalOpened}
            </span>
            <span className="text-xs font-medium text-purple-600 dark:text-purple-400">
              ({stats.openRate}%)
            </span>
          </div>
        </div>

        {/* Replied */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Replied</span>
            <div className="h-7 w-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <MessageSquareReply className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white font-mono">
              {stats.totalReplied}
            </span>
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
              ({stats.replyRate}%)
            </span>
          </div>
        </div>

        {/* Failed / Bounces */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Failed / Bounced</span>
            <div className="h-7 w-7 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <AlertTriangle className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white font-mono">
              {stats.totalFailed}
            </span>
            <span className="text-xs text-slate-400">errors</span>
          </div>
        </div>

        {/* Avg Latency */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Avg API Latency</span>
            <div className="h-7 w-7 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Zap className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white font-mono">
              +{stats.avgLatencyMs}
            </span>
            <span className="text-xs text-slate-400">ms</span>
          </div>
        </div>
      </div>

      {/* 2. Control Toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Search Bar */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by lead email, name, subject, or message ID..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200/60 dark:border-slate-800/60 overflow-x-auto text-xs">
          {["ALL", "OPENED", "REPLIED", "SENT", "FAILED"].map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                statusFilter === tab
                  ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              {tab === "ALL" ? "All Emails" : tab.charAt(0) + tab.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        {/* Actions (Time Range, Live Sync, Refresh, CSV) */}
        <div className="flex items-center gap-2">
          {/* Time Range */}
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>

          {/* Live Sync Toggle */}
          <button
            onClick={toggleLiveSync}
            title={isLiveSync ? "Live Auto-Sync Active (every 8s)" : "Auto-Sync Paused"}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
              isLiveSync
                ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300"
                : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500"
            }`}
          >
            <Radio className={`h-3.5 w-3.5 ${isLiveSync ? "text-emerald-500 animate-pulse" : "text-slate-400"}`} />
            <span className="hidden sm:inline">{isLiveSync ? "Live" : "Paused"}</span>
          </button>

          {/* Refresh Button */}
          <button
            onClick={refreshNow}
            disabled={isValidating}
            title="Refresh stream now"
            className="p-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isValidating ? "animate-spin text-orange-500" : ""}`} />
          </button>

          {/* Export to CSV */}
          <button
            onClick={exportToCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold hover:bg-slate-800 dark:hover:bg-slate-100 shadow-sm transition-all"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
        </div>
      </div>

      {/* 3. Excel Spreadsheet Grid Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold tracking-wider uppercase text-[11px]">
                <th className="py-3 px-4">Lead / Recipient</th>
                <th className="py-3 px-3">Sender Inbox</th>
                <th className="py-3 px-3">Subject / Step</th>
                <th className="py-3 px-3 text-center">Scheduled</th>
                <th className="py-3 px-3 text-center">Sent</th>
                <th className="py-3 px-3 text-center">Gmail Accepted</th>
                <th className="py-3 px-3 text-center">Opened</th>
                <th className="py-3 px-3 text-center">Replied</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto text-orange-500 mb-2" />
                    <span>Loading real-time email timeline...</span>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <Inbox className="h-8 w-8 mx-auto text-slate-300 dark:text-slate-700 mb-2" />
                    <span>No email records found matching your filters.</span>
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
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 cursor-pointer transition-colors group"
                    >
                      {/* 1. Lead / Recipient */}
                      <td className="py-3.5 px-4 font-medium text-slate-900 dark:text-white">
                        <div className="flex items-center gap-2.5">
                          <div className="h-7 w-7 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center font-bold text-[10px]">
                            {item.recipientName ? item.recipientName.charAt(0).toUpperCase() : item.recipientEmail.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-semibold block">{item.recipientEmail}</span>
                            {item.recipientName && (
                              <span className="text-[10px] text-slate-400 block">{item.recipientName}</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 2. Sender Inbox */}
                      <td className="py-3.5 px-3 text-slate-600 dark:text-slate-400 font-mono text-[11px] max-w-[160px] truncate">
                        {item.senderEmail}
                      </td>

                      {/* 3. Subject / Step */}
                      <td className="py-3.5 px-3 text-slate-800 dark:text-slate-200 max-w-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                            S{item.stepNumber}
                          </span>
                          <span className="truncate">{item.subject}</span>
                        </div>
                      </td>

                      {/* 4. Scheduled */}
                      <td className="py-3.5 px-3 text-center text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                        {formatShortDate(item.lifecycle.scheduled.at)}
                      </td>

                      {/* 5. Sent */}
                      <td className="py-3.5 px-3 text-center">
                        {isSent ? (
                          <div className="inline-flex flex-col items-center">
                            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                              <CheckCircle2 className="h-4 w-4" />
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {formatShortTime(item.lifecycle.sent.at)}
                            </span>
                          </div>
                        ) : isFailed ? (
                          <span className="inline-flex items-center text-rose-500">
                            <XCircle className="h-4 w-4" />
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600 font-bold">
                            <Minus className="h-4 w-4 mx-auto" />
                          </span>
                        )}
                      </td>

                      {/* 6. Gmail Accepted */}
                      <td className="py-3.5 px-3 text-center">
                        {isAccepted ? (
                          <div className="inline-flex flex-col items-center">
                            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                              <CheckCircle2 className="h-4 w-4" />
                            </span>
                            {item.lifecycle.gmailAccepted.latencyMs !== null && (
                              <span className="text-[10px] text-emerald-600/80 font-mono font-medium">
                                +{item.lifecycle.gmailAccepted.latencyMs}ms
                              </span>
                            )}
                          </div>
                        ) : isFailed ? (
                          <span className="inline-flex items-center text-rose-500">
                            <XCircle className="h-4 w-4" />
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600 font-bold">
                            <Minus className="h-4 w-4 mx-auto" />
                          </span>
                        )}
                      </td>

                      {/* 7. Opened */}
                      <td className="py-3.5 px-3 text-center">
                        {isOpened ? (
                          <div className="inline-flex flex-col items-center">
                            <span className="inline-flex items-center gap-1 text-purple-600 dark:text-purple-400 font-bold">
                              <CheckCircle2 className="h-4 w-4" />
                              <span>{item.lifecycle.opened.count}x</span>
                            </span>
                            <span className="text-[10px] text-purple-600/70 font-mono">
                              {formatShortTime(item.lifecycle.opened.firstAt)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600 font-bold">
                            <Minus className="h-4 w-4 mx-auto" />
                          </span>
                        )}
                      </td>

                      {/* 8. Replied */}
                      <td className="py-3.5 px-3 text-center">
                        {isReplied ? (
                          <div className="inline-flex flex-col items-center">
                            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                              <CheckCircle2 className="h-4 w-4" />
                            </span>
                            <span className="text-[10px] text-emerald-600/70 font-mono">
                              {formatShortTime(item.lifecycle.replied.at)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600 font-bold">
                            <Minus className="h-4 w-4 mx-auto" />
                          </span>
                        )}
                      </td>

                      {/* 9. Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <span className="inline-flex items-center gap-1 text-slate-400 group-hover:text-orange-500 text-xs font-semibold transition-colors">
                          <span>Inspect</span>
                          <ChevronRight className="h-3.5 w-3.5" />
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-950/40 flex items-center justify-between text-xs text-slate-400">
          <span>Showing {items.length} records</span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Real-Time Stream Active</span>
          </span>
        </div>
      </div>

      {/* Slide-Over Forensics Drawer */}
      <TimelineDetailDrawer
        item={selectedItem}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onRefresh={refreshNow}
      />
    </div>
  );
}
