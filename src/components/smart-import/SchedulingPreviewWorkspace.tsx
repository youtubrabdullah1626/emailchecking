"use client";

import React, { useState, useEffect, useMemo } from "react";
import useSWR from "swr";
import { apiClient } from "@/lib/api-client";
import { useImport } from "@/components/providers/ImportProvider";
import { ExecutionQueueItem } from "@/lib/scheduler/SchedulingTypes";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { CalendarDays, Clock, Check, AlertTriangle, Layers, Calendar, ShieldCheck, Mail } from "lucide-react";
import { Progress } from "@/components/ui/progress";

import { SystemCertification } from "./SystemCertification";
import { DuplicateWarningModal } from "./DuplicateWarningModal";

export function SchedulingPreviewWorkspace() {
  const { queueSummary, getExecutionQueue, approveImport, appendTargetSessionId, startScheduling, setStatus, status, getSequences, removeSequencesByEmail } = useImport() as any;
  const { data: warmupStatus } = useSWR("/api/warmup/status", url => apiClient<any>(url));
  const { data: warmupSettings } = useSWR("/api/warmup/settings", url => apiClient<any>(url));
  const { data: accountStats } = useSWR("/api/dashboard/header-stats", url => apiClient<any>(url));

  const [queueSlice, setQueueSlice] = useState<ExecutionQueueItem[]>([]);
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 100;

  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  const [duplicateList, setDuplicateList] = useState<any[]>([]);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const duplicateCheckPromiseRef = React.useRef<Promise<any> | null>(null);
  const precomputedDuplicatesRef = React.useRef<{ done: boolean; duplicates: any[] }>({ done: false, duplicates: [] });

  const connectedAccounts: string[] = useMemo(() => {
    if (accountStats?.accounts && Array.isArray(accountStats.accounts) && accountStats.accounts.length > 0) {
      return accountStats.accounts;
    }
    if (accountStats?.connectedGmail && !accountStats.connectedGmail.includes("Rotating")) {
      return [accountStats.connectedGmail];
    }
    return ["Primary Inbox"];
  }, [accountStats]);

  const senderMap = useMemo(() => {
    const map = new Map<string, string>();
    if (connectedAccounts.length === 0) return map;

    const distinctRecipients = Array.from(new Set(queueSlice.map(q => q.recipientEmail.toLowerCase()))).sort();
    distinctRecipients.forEach((email, idx) => {
      map.set(email, connectedAccounts[idx % connectedAccounts.length]);
    });
    return map;
  }, [connectedAccounts, queueSlice]);

  // Pre-check duplicates in the background as soon as preview loads
  useEffect(() => {
    const sequences = getSequences();
    if (!sequences || sequences.length === 0) return;

    duplicateCheckPromiseRef.current = fetch("/api/smart-import/check-duplicates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sequences, targetCampaignId: appendTargetSessionId || null })
    })
      .then(r => r.json())
      .then(data => {
        const dups = data.duplicates || [];
        precomputedDuplicatesRef.current = { done: true, duplicates: dups };
        setDuplicateList(dups);
        return dups;
      })
      .catch(() => {
        precomputedDuplicatesRef.current = { done: true, duplicates: [] };
        return [];
      });
  }, [getSequences, appendTargetSessionId]);

  const handleExecuteStrategy = async () => {
    // Instant 0ms response if pre-check finished in background
    if (precomputedDuplicatesRef.current.done) {
      const dups = precomputedDuplicatesRef.current.duplicates;
      if (dups.length > 0) {
        setDuplicateList(dups);
        setShowDuplicateModal(true);
        return;
      }
      await approveImport();
      return;
    }

    setIsCheckingDuplicates(true);
    try {
      let dups: any[] = [];
      if (duplicateCheckPromiseRef.current) {
        dups = await duplicateCheckPromiseRef.current;
      } else {
        const sequences = getSequences();
        const res = await fetch("/api/smart-import/check-duplicates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sequences, targetCampaignId: appendTargetSessionId || null })
        });
        const data = await res.json().catch(() => ({}));
        dups = data.duplicates || [];
      }

      if (dups.length > 0) {
        setDuplicateList(dups);
        setShowDuplicateModal(true);
        setIsCheckingDuplicates(false);
        return;
      }

      await approveImport();
    } catch (e) {
      console.error("Duplicate check error, proceeding to import:", e);
      await approveImport();
    } finally {
      setIsCheckingDuplicates(false);
    }
  };

  const handleConfirmDuplicates = async (selectedEmailsToKeep: string[]) => {
    const keepSet = new Set(selectedEmailsToKeep);
    // Any duplicate email NOT selected to keep should be removed
    const emailsToRemove = duplicateList.map(d => d.email).filter(email => !keepSet.has(email));

    if (emailsToRemove.length > 0 && removeSequencesByEmail) {
      removeSequencesByEmail(emailsToRemove);
    }
    setShowDuplicateModal(false);
    await approveImport();
  };

  useEffect(() => {
    const allItems = getExecutionQueue();
    setQueueSlice(allItems.slice(0, ITEMS_PER_PAGE * page));
  }, [getExecutionQueue, page]);

  const effectiveQueueSummary = (() => {
    if (queueSummary && queueSummary.totalItems > 0) {
      return queueSummary;
    }
    const allItems = getExecutionQueue();
    if (allItems.length === 0) return null;
    const dates = allItems.map((i: any) => i.scheduledDate).sort();
    const uniqueDays = new Set(dates);
    return {
      totalItems: allItems.length,
      totalDays: uniqueDays.size,
      startDate: dates[0] || "N/A",
      endDate: dates[dates.length - 1] || "N/A",
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

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {effectiveQueueSummary.existingQueueMetrics && effectiveQueueSummary.existingQueueMetrics.skippedDuplicates > 0 && (
        <Alert className="bg-amber-50/50 border-amber-200 text-amber-900 mb-6 shadow-sm">
          <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 ml-2">
            <div>
              <AlertTitle className="text-amber-800 font-bold text-base">Duplicates Detected & Skipped</AlertTitle>
              <AlertDescription className="text-amber-700/90 mt-1">
                <strong>{effectiveQueueSummary.existingQueueMetrics.skippedDuplicates}</strong> leads were automatically skipped because they are already scheduled in {appendTargetSessionId ? "the existing campaign" : "another active campaign"}.
              </AlertDescription>
            </div>
            <Button 
              variant="outline" 
              className="bg-white border-amber-300 text-amber-700 hover:bg-amber-50 hover:text-amber-800 shadow-sm whitespace-nowrap"
              onClick={() => {
                startScheduling(warmupStatus, warmupSettings, undefined, true);
              }}
            >
              Send Anyway (Include Duplicates)
            </Button>
          </div>
        </Alert>
      )}

      {/* Virtualized/Paginated Execution Queue Full Width */}
      <Card className="border-border shadow-sm flex flex-col overflow-hidden h-[500px]">
        <CardHeader className="bg-muted/5 border-b border-border py-3">
          <CardTitle className="text-sm font-semibold flex items-center justify-between">
            <span>Email Send Schedule ({effectiveQueueSummary.totalItems} Emails)</span>
            {connectedAccounts.length > 1 && (
              <Badge variant="outline" className="text-[11px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-semibold">
                {connectedAccounts.length} Inboxes Rotating
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <ScrollArea className="flex-1">
          <div className="p-0">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/30 sticky top-0 border-b border-border backdrop-blur-sm z-10">
                <tr>
                  <th className="px-5 py-3 font-medium text-muted-foreground">Scheduled Send Date & Time</th>
                  <th className="px-5 py-3 font-medium text-muted-foreground">Sending From</th>
                  <th className="px-5 py-3 font-medium text-muted-foreground">Recipient</th>
                  <th className="px-5 py-3 font-medium text-muted-foreground text-right">Sequence Step</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {queueSlice.map((item, idx) => {
                  const assignedSender = item.senderEmail || senderMap.get(item.recipientEmail.toLowerCase()) || connectedAccounts[0] || "Primary Inbox";
                  return (
                    <tr key={item.queueId + idx} className="hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-3 font-mono text-xs whitespace-nowrap">
                        {item.scheduledDate} <span className="text-muted-foreground ml-1.5">{item.scheduledTime}</span>
                      </td>
                      <td className="px-5 py-3 text-xs">
                        <div className="flex items-center gap-1.5 font-medium text-foreground">
                          <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="truncate max-w-[220px] font-mono text-[11px]">
                            {assignedSender}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3 font-medium truncate max-w-[260px] text-xs">
                        {item.recipientEmail}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Badge variant={item.sequenceStep.stepNumber === 1 ? "default" : "outline"} className="text-[10px]">
                          Email {item.sequenceStep.stepNumber}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {hasMore && (
              <div className="p-4 border-t border-border text-center bg-muted/5">
                <Button variant="outline" className="w-full text-xs font-semibold" onClick={handleLoadMore}>
                  Load Next 100 (Showing {queueSlice.length} / {totalAvailable})
                </Button>
              </div>
            )}
          </div>
        </ScrollArea>
      </Card>

      <div className="flex justify-end pt-6 border-t border-border">
        <Button 
          onClick={handleExecuteStrategy} 
          disabled={status === "EXECUTING" || isCheckingDuplicates}
          className="gap-2 shadow-md bg-emerald-600 hover:bg-emerald-700 text-white px-8 transition-all duration-300 min-w-[240px]"
        >
          {status === "EXECUTING" || isCheckingDuplicates ? (
            <>
              <div className="animate-spin h-4 w-4 border-2 border-white/20 border-t-white rounded-full mr-2" />
              {isCheckingDuplicates ? "Checking Duplicates..." : "Syncing to Database..."}
            </>
          ) : (
            <>
              <Check className="h-4 w-4" />
              Launch Campaign
            </>
          )}
        </Button>
      </div>

      <DuplicateWarningModal 
        isOpen={showDuplicateModal}
        onOpenChange={setShowDuplicateModal}
        duplicates={duplicateList}
        onConfirm={handleConfirmDuplicates}
      />
    </div>
  );
}
