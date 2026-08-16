"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ServerCog, Play, RefreshCw, MailSearch, Info, AlertTriangle, CheckCircle, XCircle, Sparkles } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { toast } from "sonner";
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

export default function AdminSchedulerPage() {
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
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 15000); // 15s polling
    return () => clearInterval(interval);
  }, [loadStats]);

  const handleForceRun = async () => {
    setRunning(true);
    try {
      const res = await fetch("/api/scheduler/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: true })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Execution failed");
      }
      toast.success(`Run completed: ${data.emailsSent ?? 0} sent, ${data.claimedSteps ?? 0} claimed.`);
      loadStats();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to trigger run";
      toast.error(msg);
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
        body: JSON.stringify({ dryRun: true })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Dry run failed");
      }
      setDryRunData(data);
      setIsDryRunModalOpen(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Dry run failed";
      toast.error(msg);
    } finally {
      setRunning(false);
    }
  };

  const handleScanReplies = async () => {
    setScanning(true);
    try {
      const res = await fetch("/api/replies/scan", {
        method: "POST"
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Scan failed");
      }
      toast.success(`Replies scanned: ${data.newRepliesFound ?? 0} new replies found across accounts.`);
      loadStats();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Scan failed";
      toast.error(msg);
    } finally {
      setScanning(false);
    }
  };

  return (
    <WarmupProvider>
      <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
        {/* Signature Silaer Dynamic Header Banner */}
        <div className="bg-gradient-to-r from-primary/15 via-primary/5 to-card border border-primary/20 rounded-2xl p-5 md:p-6 shadow-xs relative overflow-hidden transition-colors duration-300">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-start sm:items-center gap-4">
              <div className="h-11 w-11 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0 border border-primary/25 shadow-xs">
                <ServerCog className="h-5 w-5" />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                    Scheduler & Warmup Operations
                  </h1>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border border-primary/25 bg-primary/15 text-primary">
                    <Sparkles className="h-2.5 w-2.5" />
                    Admin Control
                  </span>
                </div>
                <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 mt-1">
                  Administrative control center for background execution cron engines, email velocity pacing, and automated mailbox warmup schedules.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleScanReplies}
                disabled={scanning}
                className="border-border text-foreground hover:bg-muted"
              >
                <MailSearch className={`h-4 w-4 mr-1.5 ${scanning ? "animate-spin" : ""}`} />
                {scanning ? "Scanning..." : "Scan Replies"}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleDryRun}
                disabled={running}
                className="border-border text-foreground hover:bg-muted"
              >
                <RefreshCw className={`h-4 w-4 mr-1.5 ${running ? "animate-spin" : ""}`} />
                Dry Run
              </Button>

              <Button
                size="sm"
                onClick={handleForceRun}
                disabled={running}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-xs"
              >
                <Play className={`h-4 w-4 mr-1.5 fill-current ${running ? "animate-pulse" : ""}`} />
                {running ? "Executing..." : "Force Run"}
              </Button>
            </div>
          </div>
        </div>

        {/* Top-Level Tabs: Overview vs Queue vs Warmup */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="w-full justify-start border-b border-border bg-transparent p-0 h-auto rounded-none gap-6">
            <TabsTrigger value="overview" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 py-2">Overview</TabsTrigger>
            <TabsTrigger value="queue" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 py-2">Queue</TabsTrigger>
            <TabsTrigger value="warmup" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 py-2">Warmup</TabsTrigger>
          </TabsList>

          {/* OVERVIEW TAB */}
          <TabsContent value="overview" className="space-y-6 mt-6">
            {loading && !stats ? (
              <div className="flex justify-center items-center py-12">
                <RefreshCw className="h-6 w-6 text-primary animate-spin" />
              </div>
            ) : error && !stats ? (
              <Card className="p-6 text-center text-destructive border-destructive/20 bg-destructive/10">
                <p className="font-semibold">{error}</p>
                <Button variant="outline" size="sm" onClick={loadStats} className="mt-3">Retry</Button>
              </Card>
            ) : stats ? (
              <>
                {/* Top Stat Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* System Health Card */}
                  <Card className="border-border shadow-xs bg-card">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
                        <ServerCog className="h-4 w-4 text-primary" />
                        System Status
                      </CardTitle>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        stats.schedulerHealth === "HEALTHY" 
                          ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300"
                          : "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300"
                      }`}>
                        {stats.schedulerHealth}
                      </span>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-muted-foreground">Last Run</span>
                        <span className="font-medium text-foreground">
                          {stats.lastSchedulerRun 
                            ? formatDistanceToNow(new Date(stats.lastSchedulerRun), { addSuffix: true })
                            : "Never"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-muted-foreground">Next Scheduled</span>
                        <span className="font-medium text-foreground">
                          {stats.nextExpectedCron}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs pt-1 border-t border-border">
                        <span className="text-muted-foreground">Avg Send Time: {(stats.averageSendTimeMs / 1000).toFixed(2)}s</span>
                        <span className={`text-[10px] font-mono ${stats.cronHealth === "HEALTHY" ? "text-emerald-500" : "text-amber-500"}`}>
                          Cron Health: {stats.cronHealth}
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Volume Card */}
                  <Card className="border-border shadow-xs bg-card">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Total Emails Sent</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-foreground">{stats.totalEmailsSent.toLocaleString()}</div>
                      <p className="text-xs text-muted-foreground mt-1">{stats.completedToday} sent today across active campaigns</p>
                    </CardContent>
                  </Card>

                  {/* Pending Steps Card */}
                  <Card className="border-border shadow-xs bg-card">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Pending Steps</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-foreground">{stats.pendingSteps.toLocaleString()}</div>
                      <p className="text-xs text-muted-foreground mt-1">{stats.pendingDue} due immediately, {stats.pendingFuture} future scheduled</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Secondary Diagnostics Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Queue Distribution */}
                  <Card className="border-border shadow-xs bg-card">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-semibold text-foreground">Active Processing & Faults</CardTitle>
                      <CardDescription className="text-xs">Live breakdown of sequence execution states</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex justify-between items-center py-2 border-b border-border text-sm">
                        <span className="flex items-center gap-2 text-foreground">
                          <RefreshCw className="h-4 w-4 text-primary animate-spin" /> Currently Processing
                        </span>
                        <span className="font-mono text-xs px-2 py-0.5 rounded bg-muted text-foreground">{stats.processingSteps}</span>
                      </div>

                      <div className="flex justify-between items-center py-2 border-b border-border text-sm">
                        <span className="flex items-center gap-2 text-foreground">
                          <AlertTriangle className="h-4 w-4 text-amber-500" /> Stale / Stuck Locked Steps
                        </span>
                        <span className={`font-mono text-xs px-2 py-0.5 rounded ${
                          stats.staleProcessingCount > 0 ? "bg-destructive/10 text-destructive font-bold" : "bg-muted text-foreground"
                        }`}>
                          {stats.staleProcessingCount}
                        </span>
                      </div>

                      <div className="flex justify-between items-center py-2 text-sm">
                        <span className="flex items-center gap-2 text-foreground">
                          <XCircle className="h-4 w-4 text-destructive" /> Total Failed Steps
                        </span>
                        <span className={`font-mono text-xs px-2 py-0.5 rounded ${
                          stats.failedSteps > 0 ? "bg-destructive/10 text-destructive font-bold" : "bg-muted text-foreground"
                        }`}>
                          {stats.failedSteps}
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Engine Configuration Reference */}
                  <Card className="border-border shadow-xs bg-card">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-semibold text-foreground">Heartbeat & Delivery Windows</CardTitle>
                      <CardDescription className="text-xs">Cron timing and schedule safety settings</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 text-xs">
                      <div className="flex justify-between py-1.5 border-b border-border">
                        <span className="text-muted-foreground">Cadence</span>
                        <span className="font-medium text-foreground">Every 5 minutes (Continuous)</span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-border">
                        <span className="text-muted-foreground">Stale Claim Lock Timeout</span>
                        <span className="font-medium text-foreground">10 minutes (Auto-healed)</span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-border">
                        <span className="text-muted-foreground">Max Batch Per Run</span>
                        <span className="font-medium text-foreground">50 emails / cycle</span>
                      </div>
                      <div className="flex justify-between py-1.5">
                        <span className="text-muted-foreground">Last Inbox Scan</span>
                        <span className="font-medium text-foreground">
                          {stats.lastReplyScan ? format(new Date(stats.lastReplyScan), "PPpp") : "Never"}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </>
            ) : null}
          </TabsContent>

          {/* QUEUE TAB */}
          <TabsContent value="queue" className="space-y-6 mt-6">
            <Card className="border-border shadow-xs bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-foreground">Active Step Execution Queue</CardTitle>
                <CardDescription className="text-xs">Real-time status of sequence steps awaiting execution or in-flight</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Queue Status</TableHead>
                      <TableHead>Count</TableHead>
                      <TableHead>Description</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-emerald-500" /> Pending (Due Now)
                      </TableCell>
                      <TableCell className="font-mono text-sm">{stats?.pendingDue ?? 0}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">Eligible for immediate pickup on next cron run</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium flex items-center gap-2">
                        <Info className="h-4 w-4 text-primary" /> Pending (Future)
                      </TableCell>
                      <TableCell className="font-mono text-sm">{stats?.pendingFuture ?? 0}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">Scheduled for upcoming delivery windows</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium flex items-center gap-2">
                        <RefreshCw className="h-4 w-4 text-primary animate-spin" /> In-Flight Processing
                      </TableCell>
                      <TableCell className="font-mono text-sm">{stats?.processingSteps ?? 0}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">Currently being dispatched via Gmail API</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium flex items-center gap-2">
                        <XCircle className="h-4 w-4 text-destructive" /> Failed Steps
                      </TableCell>
                      <TableCell className="font-mono text-sm text-destructive">{stats?.failedSteps ?? 0}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">Encountered send errors or bounced accounts</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* WARMUP TAB */}
          <TabsContent value="warmup" className="mt-6">
            <WarmupTab />
          </TabsContent>
        </Tabs>

        {/* Dry Run Modal */}
        <Dialog open={isDryRunModalOpen} onOpenChange={setIsDryRunModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-foreground">
                <Info className="h-5 w-5 text-primary" />
                Dry Run Simulation Results
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Simulated scheduler scan without dispatching actual outbound emails.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-4 text-sm">
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">Candidates Found:</span>
                <span className="font-semibold text-foreground">{dryRunData?.candidatesFound ?? 0}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">Eligible to Claim:</span>
                <span className="font-semibold text-foreground">{dryRunData?.claimedSteps ?? 0}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground">Skipped (Limits/Blackout):</span>
                <span className="font-semibold text-foreground">{dryRunData?.skippedSteps ?? 0}</span>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => setIsDryRunModalOpen(false)} className="w-full">
                Dismiss
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </WarmupProvider>
  );
}
