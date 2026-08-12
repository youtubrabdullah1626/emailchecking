"use client";

import React from "react";
import { useImport } from "@/components/providers/ImportProvider";
import { CheckCircle2, Loader2, AlertTriangle, Users, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * BulkImportProgress
 * 
 * A premium, real-time progress component that renders during a chunked bulk import.
 * Shows chunk-by-chunk progress, live contact counts, and a success screen.
 * This is what separates a professional app from an amateur one.
 */
export function BulkImportProgress() {
  const { bulkProgress } = useImport() as any;

  if (!bulkProgress) return null;

  const { totalChunks, chunksLoaded, totalRows, successCount, failureCount, isComplete } = bulkProgress;
  
  const progressPercent = totalChunks > 0 
    ? Math.min(100, Math.round((chunksLoaded / totalChunks) * 100)) 
    : 0;

  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-8 animate-in fade-in duration-500">
      
      {/* Icon: Complete vs Loading */}
      <div className={cn(
        "relative flex items-center justify-center h-24 w-24 rounded-full transition-all duration-700",
        isComplete 
          ? "bg-emerald-500/10 ring-4 ring-emerald-500/20" 
          : "bg-primary/10 ring-4 ring-primary/20"
      )}>
        {isComplete ? (
          <CheckCircle2 className="h-12 w-12 text-emerald-500 animate-in zoom-in duration-500" />
        ) : (
          <Loader2 className="h-12 w-12 text-primary animate-spin" />
        )}
      </div>

      {/* Title */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold tracking-tight">
          {isComplete ? "Import Complete! 🎉" : "Importing Contacts..."}
        </h2>
        <p className="text-muted-foreground max-w-sm text-center text-sm">
          {isComplete 
            ? "Your contacts have been saved. Redirecting to your prospects now..."
            : `Processing chunk ${chunksLoaded} of ${totalChunks}. Please keep this tab open.`
          }
        </p>
      </div>

      {/* Progress Bar */}
      {!isComplete && (
        <div className="w-full max-w-md space-y-2">
          <div className="flex justify-between text-sm font-medium">
            <span className="text-muted-foreground">Progress</span>
            <span className="text-foreground tabular-nums">{progressPercent}%</span>
          </div>
          <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Live Stats Row */}
      <div className="flex gap-6 mt-2">
        <div className="flex flex-col items-center gap-1 px-6 py-4 rounded-xl bg-card border border-border shadow-sm min-w-[110px]">
          <Users className="h-5 w-5 text-primary mb-1" />
          <span className="text-2xl font-bold tabular-nums text-foreground">{successCount.toLocaleString()}</span>
          <span className="text-xs text-muted-foreground font-medium">Imported</span>
        </div>
        
        <div className="flex flex-col items-center gap-1 px-6 py-4 rounded-xl bg-card border border-border shadow-sm min-w-[110px]">
          <Zap className="h-5 w-5 text-amber-500 mb-1" />
          <span className="text-2xl font-bold tabular-nums text-foreground">{totalRows.toLocaleString()}</span>
          <span className="text-xs text-muted-foreground font-medium">Total</span>
        </div>
        
        {failureCount > 0 && (
          <div className="flex flex-col items-center gap-1 px-6 py-4 rounded-xl bg-destructive/5 border border-destructive/20 shadow-sm min-w-[110px]">
            <AlertTriangle className="h-5 w-5 text-destructive mb-1" />
            <span className="text-2xl font-bold tabular-nums text-destructive">{failureCount.toLocaleString()}</span>
            <span className="text-xs text-destructive/70 font-medium">Skipped</span>
          </div>
        )}
      </div>

      {/* Complete success note */}
      {isComplete && failureCount > 0 && (
        <p className="text-xs text-muted-foreground text-center max-w-sm">
          <AlertTriangle className="inline h-3 w-3 mr-1 text-amber-500" />
          {failureCount.toLocaleString()} rows had invalid emails and were skipped. 
          View the full error report in the Import History tab.
        </p>
      )}
    </div>
  );
}
