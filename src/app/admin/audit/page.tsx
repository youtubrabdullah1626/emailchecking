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
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<AuditLogEvent | null>(null);

  // SWR Hook for Infinite Scrolling / Cursor Pagination
  const { 
    logs, 
    isLoading, 
    isLoadingMore, 
    isReachingEnd, 
    loadMore, 
    refresh 
  } = useAuditLogs({ q: searchQuery }, 50);

  const [isClearing, setIsClearing] = useState(false);
  const [deleteMode, setDeleteMode] = useState<"month" | "all" | null>(null);

  const handleExport = () => {
    // Basic export redirect (we built an endpoint for this!)
    const url = new URL("/api/admin/audit/export", window.location.origin);
    if (searchQuery) url.searchParams.set("q", searchQuery);
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

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
      <div className="flex-1 space-y-6 p-8 pt-6 max-w-[1600px] w-full mx-auto">
        <PageHeader
          title="Audit Log & Activity Center"
          description="Track important actions across the platform."
          actions={
            <div className="flex items-center gap-3">
              <button 
                onClick={refresh}
                disabled={isLoading || isClearing}
                className="p-2 border border-border rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
                title="Refresh"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
              </button>
              
              <button 
                onClick={() => setDeleteMode("month")}
                disabled={isClearing}
                className="px-4 py-2 bg-background border border-border text-foreground rounded-md shadow-sm text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
              >
                Clear &gt; 1 Month
              </button>

              <button 
                onClick={() => setDeleteMode("all")}
                disabled={isClearing}
                className="px-4 py-2 bg-destructive/10 border border-destructive/20 text-destructive rounded-md shadow-sm text-sm font-medium hover:bg-destructive/20 transition-colors disabled:opacity-50"
              >
                Clear All
              </button>

              <button 
                onClick={handleExport}
                className="px-4 py-2 bg-background border border-border text-foreground rounded-md shadow-sm text-sm font-medium hover:bg-muted transition-colors flex items-center gap-2"
              >
                <Download className="w-4 h-4 text-muted-foreground" />
                Export CSV
              </button>
            </div>
          }
        />

        <div className="animate-in fade-in duration-500">
          <Card className="overflow-hidden border border-border shadow-sm">
            <AuditFilters 
              onSearch={setSearchQuery} 
              onClear={() => setSearchQuery("")} 
            />
            
            <AuditDataTable 
              logs={logs as any} 
              onRowClick={setSelectedEvent} 
              isLoading={isLoading && logs.length === 0}
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
