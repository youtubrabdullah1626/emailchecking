"use client";

import React, { useState, useEffect } from "react";
import { useImport } from "@/components/providers/ImportProvider";
import { ExecutionQueueItem } from "@/lib/scheduler/SchedulingTypes";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { CalendarDays, Clock, Check, AlertTriangle, Layers, Calendar } from "lucide-react";
import { Progress } from "@/components/ui/progress";

import { SystemCertification } from "./SystemCertification";

export function SchedulingPreviewWorkspace() {
  const { queueSummary, getExecutionQueue, approveImport, appendTargetSessionId } = useImport() as any;
  const [queueSlice, setQueueSlice] = useState<ExecutionQueueItem[]>([]);
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 100;

  useEffect(() => {
    const queue = getExecutionQueue();
    if (queue) {
      setQueueSlice(queue.slice(0, ITEMS_PER_PAGE * page));
    }
  }, [getExecutionQueue, page]);

  // Fallback if queueSummary was lost during a refresh (e.g., from old sessions before the fix)
  const effectiveQueueSummary = queueSummary || (() => {
    const q = getExecutionQueue();
    if (!q || q.length === 0) return null;
    return {
      totalItems: q.length,
      totalDays: 1,
      startDate: q[0]?.scheduledDate || "Unknown",
      endDate: q[q.length - 1]?.scheduledDate || "Unknown",
      itemsPerDay: {},
      warmupLimitsHit: []
    };
  })();

  if (!effectiveQueueSummary) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-muted-foreground animate-pulse">
        <Clock className="h-8 w-8 mb-4 opacity-50" />
        <p>Restoring schedule data...</p>
      </div>
    );
  }

  const handleLoadMore = () => setPage(p => p + 1);
  const totalAvailable = effectiveQueueSummary.totalItems;
  const hasMore = queueSlice.length < totalAvailable;

  const renderDailyDensity = () => {
    return Object.entries(queueSummary.itemsPerDay).map(([date, count]) => {
      const isThrottled = queueSummary.warmupLimitsHit.includes(date);
      return (
        <div key={date} className="flex items-center justify-between p-3 border-b border-border text-sm">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{date}</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="font-mono">{String(count)} emails</span>
            {isThrottled && (
              <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-200 text-[10px]">
                Warmup Max
              </Badge>
            )}
          </div>
        </div>
      );
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Top Summary Dashboard */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card className="border-border shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between space-y-0 pb-2">
              <p className="text-sm font-medium">Total Emails to Send</p>
              <Layers className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold">{effectiveQueueSummary.totalItems.toLocaleString()}</div>
            {appendTargetSessionId && effectiveQueueSummary.existingQueueMetrics && (
              <p className="text-xs text-muted-foreground mt-1">
                + {effectiveQueueSummary.existingQueueMetrics.totalExistingScheduled} already scheduled
              </p>
            )}
          </CardContent>
        </Card>
        
        <Card className="border-border shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between space-y-0 pb-2">
              <p className="text-sm font-medium">Campaign Duration</p>
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold">{effectiveQueueSummary.totalDays} Days</div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between space-y-0 pb-2">
              <p className="text-sm font-medium">Estimated Completion</p>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold text-primary">{effectiveQueueSummary.endDate || "N/A"}</div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between space-y-0 pb-2">
              <p className="text-sm font-medium">Emails Delayed by Warmup</p>
              <AlertTriangle className={`h-4 w-4 ${effectiveQueueSummary.warmupLimitsHit.length > 0 ? "text-amber-500" : "text-emerald-500"}`} />
            </div>
            <div className="text-2xl font-bold">{effectiveQueueSummary.warmupLimitsHit.length}</div>
          </CardContent>
        </Card>
      </div>

      {appendTargetSessionId && effectiveQueueSummary.existingQueueMetrics && effectiveQueueSummary.existingQueueMetrics.skippedDuplicates > 0 && (
        <Alert className="bg-amber-50/50 border-amber-200 text-amber-900 mb-6">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle>Duplicates Skipped</AlertTitle>
          <AlertDescription>
            {effectiveQueueSummary.existingQueueMetrics.skippedDuplicates} leads were skipped because they are already scheduled in the existing campaign.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
        {/* Left Panel: Virtualized/Paginated Execution Queue */}
        <Card className="lg:col-span-2 border-border shadow-sm flex flex-col overflow-hidden h-full">
          <CardHeader className="bg-muted/5 border-b border-border py-3">
            <CardTitle className="text-sm font-semibold flex items-center justify-between">
              <span>Email Send Schedule (First {queueSlice.length})</span>
              <Badge variant="secondary">Sending Order</Badge>
            </CardTitle>
          </CardHeader>
          <ScrollArea className="flex-1">
            <div className="p-0">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/30 sticky top-0 border-b border-border backdrop-blur-sm z-10">
                  <tr>
                    <th className="px-4 py-3 font-medium text-muted-foreground">Scheduled Send Date</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">Sending To</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">Email Number</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {queueSlice.map((item, idx) => (
                    <tr key={item.queueId + idx} className="hover:bg-muted/20">
                      <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">
                        {item.scheduledDate} <span className="text-muted-foreground ml-1">{item.scheduledTime}</span>
                      </td>
                      <td className="px-4 py-3 font-medium truncate max-w-[200px]">
                        {item.recipientEmail}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={item.sequenceStep.stepNumber === 1 ? "default" : "outline"} className="text-[10px]">
                          Email {item.sequenceStep.stepNumber}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {hasMore && (
                <div className="p-4 border-t border-border text-center bg-muted/5">
                  <Button variant="outline" className="w-full text-xs" onClick={handleLoadMore}>
                    Load Next 100 (Showing {queueSlice.length} / {totalAvailable})
                  </Button>
                </div>
              )}
            </div>
          </ScrollArea>
        </Card>

        {/* Right Panel: Daily Breakdown */}
        <Card className="lg:col-span-1 border-border shadow-sm flex flex-col overflow-hidden h-full">
          <CardHeader className="bg-muted/5 border-b border-border py-3">
            <CardTitle className="text-sm font-semibold">
              Daily Email Limits
            </CardTitle>
          </CardHeader>
          <ScrollArea className="flex-1">
            <div className="flex flex-col">
              {renderDailyDensity()}
            </div>
          </ScrollArea>
        </Card>
      </div>

      <div className="flex justify-end pt-6 border-t border-border">
        <Button onClick={approveImport} className="gap-2 shadow-md bg-emerald-600 hover:bg-emerald-700 text-white px-8">
          <Check className="h-4 w-4" />
          {appendTargetSessionId ? "🚀 Confirm Append to Live Campaign" : "🚀 Start Sending Campaign"}
        </Button>
      </div>
    </div>
  );
}
