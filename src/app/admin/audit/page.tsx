"use client";

import React, { useState } from "react";
import { LegacyPageHeader as PageHeader } from "@/components/ui/legacy-adapters";
import { Card } from "@/components/ui";
import { Download, RefreshCw } from "lucide-react";
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

import { AuditLogEvent } from "./components/types";
import { AuditFilters } from "./components/AuditFilters";
import { AuditDataTable } from "./components/AuditDataTable";
import { AuditEventDrawer } from "./components/AuditEventDrawer";
import { useAuditLogs } from "./hooks/useAuditLogs";

export default function AuditPage() {
  const [filterState, setFilterState] = useState({ category: "", severity: "", status: "", time: "" });
  const [selectedEvent, setSelectedEvent] = useState<AuditLogEvent | null>(null);
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  // SWR Hook for Infinite Scrolling / Cursor Pagination
  const { 
    logs, 
    stats,
    isLoading, 
    isLoadingMore, 
    isReachingEnd, 
    loadMore, 
    refresh,
    isRefreshing
  } = useAuditLogs({ 
    category: filterState.category, 
    status: filterState.status,
    severity: filterState.severity,
    time: filterState.time
  }, 50, isLiveMode);

  const [isClearing, setIsClearing] = useState(false);
  const [deleteMode, setDeleteMode] = useState<"month" | "all" | null>(null);

  const handleExport = () => {
    // Basic export redirect (we built an endpoint for this!)
    const url = new URL("/api/admin/audit/export", window.location.origin);
    if (filterState.category) url.searchParams.set("category", filterState.category);
    if (filterState.status) url.searchParams.set("status", filterState.status);
    window.location.href = url.toString();
  };

  const handleClearLogs = async () => {
    if (!deleteMode) return;
    setIsClearing(true);
    const olderThanOneMonth = deleteMode === "month";
    try {
      const res = await fetch("/api/admin/audit", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ olderThanOneMonth })
      });
      if (res.ok) {
        toast.success("Logs cleared successfully.");
        refresh();
      } else {
        toast.error("Failed to clear logs.");
      }
    } catch (e) {
      toast.error("Error clearing logs.");
    } finally {
      setIsClearing(false);
      setDeleteMode(null);
    }
  };

  if (!mounted) {
    return <div className="flex flex-col min-h-screen bg-background" />;
  }

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Signature Silaer Warm Header Banner */}
      <div className="bg-gradient-to-r from-orange-100/70 via-amber-50/60 to-white dark:from-slate-900 dark:via-slate-900 dark:to-slate-800/80 border border-orange-200/80 dark:border-orange-950/40 rounded-2xl p-5 md:p-6 shadow-xs relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start sm:items-center gap-4">
            <div className="h-11 w-11 rounded-full bg-orange-100 dark:bg-orange-950/70 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0 border border-orange-200/80 dark:border-orange-800/50 shadow-xs">
              <RefreshCw className="h-5 w-5" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                  Security Audit Log & Forensic Stream
                </h1>
              </div>
              <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                Immutable activity logs, role change tracking, and operational security forensics.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-start md:self-center">
            <button
              onClick={() => setIsLiveMode(!isLiveMode)}
              className={`px-3 py-1.5 rounded-xl shadow-2xs text-xs font-semibold transition-all flex items-center gap-1.5 ${
                isLiveMode 
                  ? "bg-emerald-500 text-white shadow-emerald-500/20" 
                  : "bg-white/80 dark:bg-slate-900 border border-orange-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-orange-50/50"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isLiveMode ? "bg-white animate-pulse" : "bg-slate-400"}`}></span>
              Live Mode
            </button>

            <button 
              onClick={refresh}
              disabled={isLoading || isRefreshing || isClearing || isLiveMode}
              className="px-3 py-1.5 bg-white/80 dark:bg-slate-900 border border-orange-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-xl shadow-2xs text-xs font-semibold hover:bg-orange-50/50 transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-orange-600 ${isRefreshing && !isLiveMode ? "animate-spin" : ""}`} />
              Refresh
            </button>

            <button 
              onClick={handleExport}
              className="px-3 py-1.5 bg-white/80 dark:bg-slate-900 border border-orange-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-xl shadow-2xs text-xs font-semibold hover:bg-orange-50/50 transition-colors flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5 text-orange-600" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>

            <button 
              onClick={() => setDeleteMode("all")}
              disabled={isClearing}
              className="px-3 py-1.5 bg-rose-600 text-white rounded-xl shadow-xs text-xs font-semibold hover:bg-rose-700 transition-colors disabled:opacity-50"
            >
              Clear Logs
            </button>
          </div>
        </div>
      </div>

        <div className="animate-in fade-in duration-500 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="relative overflow-hidden p-5 rounded-2xl border border-blue-100/50 bg-gradient-to-b from-blue-50/50 to-transparent shadow-sm flex flex-col justify-between group">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[13px] font-medium text-slate-600 tracking-tight">Total Events</span>
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center transition-transform group-hover:scale-110">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                </div>
              </div>
              <div className="flex flex-col">
                <span className="text-3xl font-bold text-slate-900 tracking-tight">{stats?.total || 0}</span>
              </div>
            </div>

            <div className="relative overflow-hidden p-5 rounded-2xl border border-emerald-100/50 bg-gradient-to-b from-emerald-50/50 to-transparent shadow-sm flex flex-col justify-between group">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[13px] font-medium text-slate-600 tracking-tight">Success</span>
                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center transition-transform group-hover:scale-110">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                </div>
              </div>
              <div className="flex flex-col">
                <span className="text-3xl font-bold text-slate-900 tracking-tight">{stats?.successCount || 0}</span>
              </div>
            </div>

            <div className="relative overflow-hidden p-5 rounded-2xl border border-amber-100/50 bg-gradient-to-b from-amber-50/50 to-transparent shadow-sm flex flex-col justify-between group">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[13px] font-medium text-slate-600 tracking-tight">Failed / Warnings</span>
                <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center transition-transform group-hover:scale-110">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
                </div>
              </div>
              <div className="flex flex-col">
                <span className="text-3xl font-bold text-slate-900 tracking-tight">{stats?.warningCount || 0}</span>
              </div>
            </div>

            <div className="relative overflow-hidden p-5 rounded-2xl border border-red-200/60 bg-gradient-to-b from-red-50 to-transparent shadow-sm flex flex-col justify-between group">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[13px] font-medium text-red-700 tracking-tight">Critical Alerts</span>
                <div className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center transition-transform group-hover:scale-110 shadow-sm shadow-red-200">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
                </div>
              </div>
              <div className="flex flex-col">
                <span className="text-3xl font-bold text-red-700 tracking-tight">{stats?.criticalCount || 0}</span>
              </div>
            </div>
          </div>
          
          <AuditFilters 
            filters={filterState}
            setFilters={setFilterState}
            onClear={() => setFilterState({ category: "", severity: "", status: "", time: "" })} 
          />
          
          <Card className="flex-1 flex flex-col border-none sm:border-solid bg-transparent sm:bg-card overflow-hidden shadow-sm">
            <AuditDataTable 
              logs={logs as any} 
              onRowClick={setSelectedEvent} 
              isLoading={isLoading && logs.length === 0}
              isRefreshing={isRefreshing}
            />

            <div className="p-4 border-t border-border flex items-center justify-between text-sm text-muted-foreground bg-muted/30">
              <span>Showing {logs.length} activity records</span>
              <div className="flex gap-2">
                <button 
                  onClick={loadMore}
                  disabled={isReachingEnd || isLoadingMore}
                  className="px-4 py-1.5 border border-border rounded-md text-sm text-foreground bg-background hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isLoadingMore ? (
                    <><RefreshCw className="w-3 h-3 animate-spin" /> Loading...</>
                  ) : isReachingEnd ? (
                    "End of History"
                  ) : (
                    "Load Older Events"
                  )}
                </button>
              </div>
            </div>
          </Card>
        </div>

      <AuditEventDrawer 
        event={selectedEvent}
        isOpen={selectedEvent !== null}
        onClose={() => setSelectedEvent(null)}
      />

      <AlertDialog open={deleteMode !== null} onOpenChange={(open) => !open && setDeleteMode(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteMode === "month" 
                ? "This will permanently delete all audit logs older than 1 month. This action cannot be undone."
                : "This will permanently delete ALL audit logs. This action cannot be undone and you will lose all historical activity data."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isClearing}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => {
                e.preventDefault();
                handleClearLogs();
              }}
              disabled={isClearing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isClearing ? "Deleting..." : "Yes, delete logs"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
