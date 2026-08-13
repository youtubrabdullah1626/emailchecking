"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { AnimatedPage } from "@/components/ui/animated";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Database, Trash2, Search, ShieldAlert, CheckCircle2, Loader2, Info, Zap, HardDrive, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
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
import { Input } from "@/components/ui/input";

type CleanupCounts = {
  expiredTokens: number;
  staleOauth: number;
  oldErrors: number;
  oldAuditLogs: number;
  oldAiLogs: number;
  oldImportErrors: number;
};

export default function DatabaseMaintenancePage() {
  const [isSimulating, setIsSimulating] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [counts, setCounts] = useState<CleanupCounts | null>(null);
  const [totalReady, setTotalReady] = useState(0);
  const [estimatedMb, setEstimatedMb] = useState("0.00");
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [retention, setRetention] = useState<"30d" | "7d" | "24h" | "all">("30d");

  const [isVacuuming, setIsVacuuming] = useState(false);
  const [autoPilot, setAutoPilot] = useState(false);
  const [autoPilotLoading, setAutoPilotLoading] = useState(true);

  // Fetch initial auto-pilot setting
  useEffect(() => {
    fetch("/api/admin/database-cleanup")
      .then(res => res.json())
      .then(data => {
        if (data.auto_database_cleanup !== undefined) {
          setAutoPilot(data.auto_database_cleanup);
        }
        setAutoPilotLoading(false);
      })
      .catch(() => setAutoPilotLoading(false));
  }, []);

  const toggleAutoPilot = async (enabled: boolean) => {
    setAutoPilotLoading(true);
    try {
      const res = await fetch("/api/admin/database-cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_autopilot", enabled })
      });
      const data = await res.json();
      if (res.ok) {
        setAutoPilot(data.enabled);
        toast.success(enabled ? "Auto-Pilot Janitor activated! DB will be cleaned automatically." : "Auto-Pilot disabled.");
      } else throw new Error(data.error);
    } catch (err: any) {
      toast.error(err.message || "Failed to update Auto-Pilot");
    } finally {
      setAutoPilotLoading(false);
    }
  };

  const runVacuum = async () => {
    setIsVacuuming(true);
    try {
      const res = await fetch("/api/admin/database-cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "vacuum" })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Vacuum failed");
      toast.success(data.message || "Database optimized!");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsVacuuming(false);
    }
  };

  const runSimulation = async (selectedRetention: string = retention) => {
    setIsSimulating(true);
    try {
      const res = await fetch("/api/admin/database-cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preview: true, retention: selectedRetention })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Simulation failed");
      
      setCounts(data.counts);
      setTotalReady(data.total);
      if (data.estimatedMb) setEstimatedMb(data.estimatedMb);
      
      if (data.total === 0) {
        toast.info("Database is clean! No obsolete records found.");
      } else {
        toast.success(`Found ${data.total.toLocaleString()} obsolete records eligible for cleanup.`);
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSimulating(false);
    }
  };

  const executeCleanup = async () => {
    if (confirmText !== "CONFIRM") {
      toast.error("Please type CONFIRM exactly to proceed.");
      return;
    }
    
    setShowConfirm(false);
    setIsExecuting(true);
    setConfirmText("");
    
    try {
      const res = await fetch("/api/admin/database-cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preview: false, retention })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Cleanup failed");
      
      toast.success(data.message);
      
      // Reset dashboard
      setCounts(null);
      setTotalReady(0);
      
      // Re-run simulation silently to prove it's clean
      await runSimulation();
      
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsExecuting(false);
    }
  };

  // Run initial simulation on mount
  useEffect(() => {
    runSimulation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex-1 p-8 pt-6">
      <AnimatedPage className="space-y-8 max-w-5xl">
        <div className="flex items-center justify-between">
          <PageHeader
            title="Database Maintenance"
            description="Safely identify and purge obsolete logs, expired tokens, and temporary records to maintain high database performance."
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          
          {/* Main Action Panel */}
          <div className="md:col-span-8 space-y-6">
            <Card className="shadow-sm border-indigo-100 overflow-hidden relative">
              <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500" />
              <CardHeader className="bg-indigo-50/50 pb-6 border-b border-indigo-50/50">
                <CardTitle className="text-xl flex items-center gap-2 text-indigo-900">
                  <Database className="h-5 w-5 text-indigo-500" />
                  Space Reclamation Engine
                </CardTitle>
                <CardDescription className="text-indigo-900/60 font-medium">
                  Scan the database for temporary and expired records that are no longer needed.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-8">
                
                {isSimulating ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin mb-4 text-indigo-500" />
                    <p className="text-sm font-medium animate-pulse">Scanning database tables...</p>
                  </div>
                ) : counts ? (
                  <div className="space-y-8">
                    {/* Status Overview */}
                    <div className="flex items-center justify-between p-6 bg-slate-50 rounded-xl border border-slate-100">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Eligible for deletion</p>
                          <select 
                            className="text-xs bg-slate-200 border border-slate-300 rounded-md px-2 py-1 text-slate-700 font-medium focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                            value={retention}
                            onChange={(e) => {
                              const val = e.target.value as any;
                              setRetention(val);
                              runSimulation(val);
                            }}
                          >
                            <option value="30d">Older than 30 Days</option>
                            <option value="7d">Older than 7 Days</option>
                            <option value="24h">Older than 24 Hours</option>
                            <option value="all">Force Clean (All Logs)</option>
                          </select>
                        </div>
                        <p className="text-4xl font-bold text-slate-900">{totalReady.toLocaleString()}</p>
                        <p className="text-sm text-slate-500 mt-2">obsolete records found safely removable.</p>
                      </div>
                      <div className="flex flex-col items-end gap-3">
                        <Button 
                          size="lg" 
                          onClick={() => setShowConfirm(true)}
                          disabled={totalReady === 0 || isExecuting}
                          className={cn("gap-2 shadow-md w-full", totalReady > 0 ? "bg-red-600 hover:bg-red-700 text-white" : "bg-slate-200 text-slate-400")}
                        >
                          {isExecuting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          {isExecuting ? "Purging..." : "Purge All Obsolete Data"}
                        </Button>
                        {totalReady > 0 && (
                          <div className="flex items-center gap-2 text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-md border border-indigo-100">
                            <HardDrive className="h-4 w-4" />
                            <span className="text-sm font-semibold">Saves ~{estimatedMb} MB</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Detailed Breakdown */}
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
                        Detailed Breakdown
                        <span className="text-xs font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">6 Categories</span>
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <StatBox label={`Import Errors ${retention === 'all' ? '(ALL)' : retention === '30d' ? '(>30 DAYS)' : retention === '7d' ? '(>7 DAYS)' : '(>24 HOURS)'}`} count={counts.oldImportErrors} desc="Bulk import failure logs" icon="FileUp" />
                        <StatBox label={`System Errors ${retention === 'all' ? '(ALL)' : retention === '30d' ? '(>30 DAYS)' : retention === '7d' ? '(>7 DAYS)' : '(>24 HOURS)'}`} count={counts.oldErrors} desc="System trace logs" icon="ShieldAlert" />
                        <StatBox label={`Audit Logs ${retention === 'all' ? '(ALL)' : retention === '30d' ? '(>90 DAYS)' : retention === '7d' ? '(>30 DAYS)' : '(>7 DAYS)'}`} count={counts.oldAuditLogs} desc="Historic user activity logs" icon="History" />
                        <StatBox label={`AI Usage Logs ${retention === 'all' ? '(ALL)' : retention === '30d' ? '(>90 DAYS)' : retention === '7d' ? '(>30 DAYS)' : '(>7 DAYS)'}`} count={counts.oldAiLogs} desc="Historic AI generation logs" icon="Bot" />
                        <StatBox label="Expired Tokens" count={counts.expiredTokens} desc="Old login/verification tokens" icon="Key" />
                        <StatBox label={`Stale OAuth ${retention === 'all' ? '(ALL)' : '(>24 HOURS)'}`} count={counts.staleOauth} desc="Abandoned connection attempts" icon="Link" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Database className="h-12 w-12 text-slate-200 mb-4" />
                    <Button onClick={() => runSimulation()} size="lg" className="bg-indigo-600 hover:bg-indigo-700 gap-2 shadow-md">
                      <Search className="h-4 w-4" /> Run Deep Scan
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Guidelines Sidebar */}
          <div className="md:col-span-4 space-y-6">
            <Card className="shadow-sm border-slate-200 bg-slate-50/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Settings className="h-4 w-4 text-slate-700" />
                  Auto-Pilot Janitor
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium text-slate-900">Weekly Auto-Clean</p>
                    <p className="text-xs text-slate-500">Automatically purges 30-day stale data.</p>
                  </div>
                  <Switch 
                    checked={autoPilot} 
                    onCheckedChange={toggleAutoPilot}
                    disabled={autoPilotLoading}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-indigo-100 bg-indigo-50/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-indigo-900">
                  <Zap className="h-4 w-4 text-indigo-600" />
                  PostgreSQL Engine
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-slate-600">
                <p>
                  Deleting rows leaves dead tuples. Vacuum reclaims physical disk space and accelerates query planners.
                </p>
                <Button 
                  onClick={runVacuum} 
                  disabled={isVacuuming}
                  variant="outline" 
                  className="w-full bg-white border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                >
                  {isVacuuming ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Database className="h-4 w-4 mr-2" />}
                  {isVacuuming ? "Optimizing..." : "Vacuum & Optimize DB"}
                </Button>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-slate-200 bg-slate-50/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-slate-700" />
                  Strict Data Governance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-slate-600">
                <p>
                  As strict founders, maintaining a lean, fast database is critical. This tool applies hard limits to ephemeral data.
                </p>
                <ul className="space-y-3">
                  <li className="flex gap-2 items-start">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span><strong>100% Safe:</strong> Never deletes actual user contacts, campaigns, or active sequences.</span>
                  </li>
                  <li className="flex gap-2 items-start">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span><strong>Compliant:</strong> Audit logs are kept for a strict 90-day compliance window before purging.</span>
                  </li>
                  <li className="flex gap-2 items-start">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span><strong>Atomic:</strong> Deletions are isolated. If one table is locked, the others still succeed safely.</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
            
            <div className="bg-blue-50 text-blue-800 p-4 rounded-xl border border-blue-100 flex gap-3 text-sm">
              <Info className="h-5 w-5 shrink-0 text-blue-600" />
              <p>Run this maintenance once every few months, especially after completing large bulk imports.</p>
            </div>
          </div>
          
        </div>
      </AnimatedPage>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600 flex items-center gap-2">
              <ShieldAlert className="h-5 w-5" />
              Destructive Action Warning
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-700 pt-2">
              You are about to permanently delete <strong>{totalReady.toLocaleString()}</strong> records from the production database. 
              This action operates via direct SQL deletion and <strong>cannot be undone</strong>.
              <br /><br />
              Please type <strong>CONFIRM</strong> below to authorize this purge.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Input 
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              placeholder="CONFIRM"
              className="font-mono text-center tracking-widest uppercase border-red-200 focus-visible:ring-red-500"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => { e.preventDefault(); executeCleanup(); }}
              disabled={confirmText !== "CONFIRM" || isExecuting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isExecuting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Execute Hard Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Simple internal component for the detailed stats grid
function StatBox({ label, count, desc, icon }: { label: string, count: number, desc: string, icon: string }) {
  const isZero = count === 0;
  return (
    <div className={cn("p-4 rounded-lg border", isZero ? "bg-slate-50 border-slate-100 opacity-60" : "bg-white border-slate-200 shadow-sm")}>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex justify-between">
        {label}
      </p>
      <p className={cn("text-2xl font-bold", isZero ? "text-slate-400" : "text-slate-800")}>
        {count.toLocaleString()}
      </p>
      <p className="text-[11px] text-slate-400 mt-1 leading-tight">{desc}</p>
    </div>
  );
}
