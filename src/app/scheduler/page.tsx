"use client";

import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { AnimatedPage } from "@/components/ui/animated";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { ServerCog, Play, RefreshCw, MailSearch, Info, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { toast } from "sonner";
import { LegacyBadge as Badge, LegacyLoadingState as LoadingState, LegacyErrorState as ErrorState } from "@/components/ui/legacy-adapters";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WarmupProvider } from "@/components/providers/WarmupProvider";
import { WarmupTab } from "@/components/scheduler/WarmupTab";

interface SchedulerOperationalStats {
  lastSchedulerRun: string | null;
  nextExpectedCron: string;
  pendingSteps: number;
  pendingDue: number;
  pendingFuture: number;
  processingSteps: number;
  failedSteps: number;
  completedToday: number;
  totalEmailsSent: number;
  staleProcessingCount: number;
  lastReplyScan: string | null;
  schedulerHealth: "HEALTHY" | "ATTENTION_NEEDED" | "DEGRADED" | "PAUSED";
  cronHealth: "HEALTHY" | "DEGRADED";
  averageSendTimeMs: number;
  capturedAt: string;
}

export default function SchedulerPage() {
  const [stats, setStats] = useState<SchedulerOperationalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDryRunModalOpen, setIsDryRunModalOpen] = useState(false);
  const [dryRunData, setDryRunData] = useState<{ candidatesFound?: number, claimedSteps?: number, skippedSteps?: number } | null>(null);

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/scheduler/stats");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to load scheduler operational stats.");
      }
      const data = await res.json();
      setStats(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load scheduler metrics.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const handleRun = async () => {
    setRunning(true);
    try {
      const res = await fetch("/api/scheduler/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun: false }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.error || "Scheduler run failed.");
      toast.success(`Scheduler run complete. Processed ${data.claimedSteps ?? 0} steps.`);
      await loadStats();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Run failed.";
      toast.error(`Failed to run scheduler: ${msg}`);
    } finally {
      setRunning(false);
    }
  };

  const handleDryRun = async () => {
    setRunning(true);
    try {
      const res = await fetch("/api/scheduler/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.error || "Scheduler run failed.");
      
      setDryRunData(data);
      setIsDryRunModalOpen(true);
      
      await loadStats();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Run failed.";
      toast.error(`Failed to dry-run: ${msg}`);
    } finally {
      setRunning(false);
    }
  };

  const handleScan = async () => {
    setScanning(true);
    try {
      const res = await fetch("/api/replies/scan", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.error || "Scan failed.");
      toast.success(`Scan complete: ${data.realReplies ?? 0} real replies found.`);
      await loadStats();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Scan failed.";
      toast.error(`Failed to scan: ${msg}`);
    } finally {
      setScanning(false);
    }
  };

  return (
    <WarmupProvider>
      <AnimatedPage className="space-y-8 p-8 pt-6">
        <PageHeader 
          title="Scheduler Operations" 
          description="Monitor and control the background task execution engine."
        >
          <Button variant="outline" className="gap-2" onClick={handleScan} disabled={scanning || loading}>
            <MailSearch className="h-4 w-4" /> Scan Replies
          </Button>
          <Button variant="secondary" className="gap-2 bg-secondary/50 border shadow-sm" onClick={handleDryRun} disabled={running || loading}>
            <RefreshCw className="h-4 w-4" /> Dry Run
          </Button>
          <Button className="gap-2" onClick={handleRun} disabled={running || loading}>
            <Play className="h-4 w-4" fill="currentColor" /> Force Run
          </Button>
        </PageHeader>

        {error && (
          <ErrorState title="Telemetry Error" message={error} onRetry={loadStats} />
        )}

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="bg-transparent border-b rounded-none w-full justify-start h-auto p-0 space-x-6">
            <TabsTrigger value="overview" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 py-2">Overview</TabsTrigger>
            <TabsTrigger value="queue" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 py-2">Queue</TabsTrigger>
            <TabsTrigger value="warmup" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 py-2">Warmup</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            {loading && !stats ? (
              <LoadingState message="Loading live operational metrics..." />
            ) : stats ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="col-span-1 lg:col-span-2 bg-primary/5 border-primary/20 hover-elevate transition-all duration-300">
              <CardContent className="p-6 flex flex-col h-full justify-center">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <ServerCog className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold text-lg">System Status</h3>
                  </div>
                  <StatusBadge 
                    status={stats.schedulerHealth === "HEALTHY" ? "running" : stats.schedulerHealth === "ATTENTION_NEEDED" ? "pending" : stats.schedulerHealth === "PAUSED" ? "paused" : "error"} 
                    label={stats.schedulerHealth} 
                    dot 
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4 mt-6">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Last Run</p>
                    <p className="font-medium text-foreground">
                      {stats.lastSchedulerRun ? formatDistanceToNow(new Date(stats.lastSchedulerRun), { addSuffix: true }) : "Never"}
                    </p>
                    {stats.averageSendTimeMs > 0 && (
                      <p className="text-xs text-muted-foreground mt-0.5">Avg Send Time: {(stats.averageSendTimeMs / 1000).toFixed(2)}s</p>
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Next Scheduled</p>
                    <p className="font-medium text-foreground">
                      {stats.nextExpectedCron ? formatDistanceToNow(new Date(stats.nextExpectedCron), { addSuffix: true }) : "Not scheduled"}
                    </p>
                    {stats.cronHealth && (
                      <p className="text-xs text-muted-foreground mt-0.5">Cron Health: {stats.cronHealth}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <StatCard title="Total Emails Sent" value={stats.totalEmailsSent} />
            <StatCard title="Pending Steps" value={stats.pendingSteps} className={stats.pendingSteps > 0 ? "border-amber-200" : ""} />
              </div>
            ) : null}
          </TabsContent>

          <TabsContent value="queue" className="mt-6">
            {loading && !stats ? (
              <LoadingState message="Loading queue state..." />
            ) : stats ? (
              <Card>
            <CardHeader>
              <CardTitle>Execution Logs & Live Queues</CardTitle>
              <CardDescription>Real-time operational status and background task metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 mt-2 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
                {[
                  {
                    id: "pending",
                    type: stats.pendingSteps > 0 ? "info" : "success",
                    message: "Pending Execution Queue",
                    details: `${stats.pendingSteps} steps queued (${stats.pendingDue} due now, ${stats.pendingFuture} future).`,
                    timestamp: stats.capturedAt
                  },
                  {
                    id: "processing",
                    type: stats.processingSteps > 0 ? "info" : "success",
                    message: "Active Processing",
                    details: `${stats.processingSteps} steps currently claimed in-flight.`,
                    timestamp: stats.capturedAt
                  },
                  {
                    id: "failed",
                    type: stats.failedSteps > 0 ? "error" : "success",
                    message: stats.failedSteps > 0 ? "Failed Steps Require Attention" : "No Failed Steps",
                    details: stats.failedSteps > 0 ? `${stats.failedSteps} step(s) failed and require manual review.` : "Queue is free of failed operations.",
                    timestamp: stats.capturedAt
                  },
                  {
                    id: "stale",
                    type: stats.staleProcessingCount > 0 ? "warning" : "success",
                    message: stats.staleProcessingCount > 0 ? "Stale Processing Detected" : "No Stale Processing",
                    details: stats.staleProcessingCount > 0 ? `${stats.staleProcessingCount} step(s) stuck for >15 minutes.` : "All processing steps are resolving normally.",
                    timestamp: stats.capturedAt
                  },
                  {
                    id: "scan",
                    type: "info",
                    message: "Reply Scanning",
                    details: stats.lastReplyScan ? `Last automated reply scan completed.` : "No recent scans on record.",
                    timestamp: stats.lastReplyScan || stats.capturedAt
                  }
                ].map(log => (
                  <div key={log.id} className="relative flex gap-4">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full border border-border bg-card shrink-0 shadow-sm z-10">
                      {log.type === 'success' ? <CheckCircle className="h-4 w-4 text-emerald-500" /> :
                       log.type === 'error' ? <XCircle className="h-4 w-4 text-red-500" /> :
                       log.type === 'warning' ? <AlertTriangle className="h-4 w-4 text-amber-500" /> :
                       <Info className="h-4 w-4 text-blue-500" />}
                    </div>
                    <div className="flex-1 bg-card border border-border p-4 rounded-xl shadow-sm">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-medium text-sm text-foreground">{log.message}</span>
                        <span className="text-xs text-muted-foreground">{format(new Date(log.timestamp), "MMM d, HH:mm:ss")}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 mb-0">{log.details}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
            ) : null}
          </TabsContent>

          <TabsContent value="warmup" className="mt-6">
            <WarmupTab />
          </TabsContent>
        </Tabs>

      <Dialog open={isDryRunModalOpen} onOpenChange={setIsDryRunModalOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Dry Run Results</DialogTitle>
            <DialogDescription>
              This shows what would happen if the scheduler ran right now. No emails have been sent.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            <p className="font-medium mb-4">Pending steps to process: {dryRunData?.candidatesFound ?? 0}</p>
            <div className="max-h-96 overflow-auto border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Metric</TableHead>
                    <TableHead>Count</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium text-sm">Candidates Evaluated</TableCell>
                    <TableCell className="font-bold text-sm">{dryRunData?.candidatesFound ?? 0}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">Total steps matched by scheduler engine criteria</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium text-sm text-emerald-600">Ready to Claim</TableCell>
                    <TableCell className="font-bold text-sm text-emerald-600">{dryRunData?.claimedSteps ?? 0}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">Valid emails fully resolved and ready to dispatch</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium text-sm text-amber-600">Skipped Steps</TableCell>
                    <TableCell className="font-bold text-sm text-amber-600">{dryRunData?.skippedSteps ?? 0}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">Missing criteria, absent bodies, or rate-limited</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDryRunModalOpen(false)}>Close</Button>
            <Button onClick={() => { setIsDryRunModalOpen(false); handleRun(); }} disabled={dryRunData?.claimedSteps === 0 || running}>
              Execute Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </AnimatedPage>
    </WarmupProvider>
  );
}
