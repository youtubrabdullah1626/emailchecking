"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { AnimatedPage } from "@/components/ui/animated";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  FileUp, Users, CheckCircle2, XCircle, Clock, AlertTriangle,
  Download, RefreshCw, Database, RotateCcw, Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, format } from "date-fns";

type ImportJob = {
  id: string;
  status: string;
  fileName: string;
  totalRows: number;
  successCount: number;
  failureCount: number;
  skippedCount: number;
  campaignId: string | null;
  campaignName: string | null;
  importTag: string | null;
  chunksTotal: number;
  chunksLoaded: number;
  createdAt: string;
  completedAt: string | null;
  revertedAt: string | null;
  users: { name: string | null; email: string | null };
};

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string; icon: any }> = {
    COMPLETED:  { label: "Completed",  className: "bg-emerald-500/10 text-emerald-600 border-emerald-200", icon: CheckCircle2 },
    PROCESSING: { label: "Processing", className: "bg-blue-500/10 text-blue-600 border-blue-200",          icon: Clock },
    PENDING:    { label: "Pending",    className: "bg-amber-500/10 text-amber-600 border-amber-200",       icon: Clock },
    FAILED:     { label: "Failed",     className: "bg-red-500/10 text-red-600 border-red-200",             icon: XCircle },
    ABORTED:    { label: "Aborted",    className: "bg-gray-500/10 text-gray-600 border-gray-200",          icon: XCircle },
    REVERTED:   { label: "Reverted",   className: "bg-orange-500/10 text-orange-600 border-orange-200",    icon: RotateCcw },
  };
  const c = config[status] || config.PENDING;
  const Icon = c.icon;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border", c.className)}>
      <Icon className="h-3 w-3" />
      {c.label}
    </span>
  );
}

export default function ImportHistoryAdminPage() {
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [revertingId, setRevertingId] = useState<string | null>(null);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });

  const fetchJobs = async (page = 1) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/admin/import-history?page=${page}&limit=20`);
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setJobs(data.jobs || []);
      setPagination(data.pagination || { page: 1, total: 0, totalPages: 1 });
    } catch {
      toast.error("Failed to load import history");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchJobs(); }, []);

  // FIX 1: Error download uses the dedicated API endpoint (not JSON blob from list query)
  const handleDownloadErrors = (job: ImportJob) => {
    if (job.failureCount === 0) {
      toast.info("No errors to download for this import.");
      return;
    }
    // Opens the CSV stream endpoint directly — browser handles the download
    window.open(`/api/smart-import/errors/${job.id}?format=csv`, "_blank");
    toast.success("Downloading error report...");
  };

  // FIX 3: Revert import using the transactional revert endpoint
  const handleRevert = async (job: ImportJob) => {
    if (!confirm(
      `Are you sure you want to REVERT this import?\n\nThis will permanently delete ${job.successCount.toLocaleString()} contacts and all their sequences from "${job.campaignName || job.fileName}".\n\nThis action cannot be undone.`
    )) return;

    setRevertingId(job.id);
    try {
      const res = await fetch(`/api/smart-import/revert/${job.id}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Revert failed");
      toast.success(data.message || "Import reverted successfully.");
      fetchJobs(pagination.page);
    } catch (err: any) {
      toast.error(err.message || "Failed to revert import.");
    } finally {
      setRevertingId(null);
    }
  };

  const totalSuccessAll = jobs.reduce((a, j) => a + j.successCount, 0);
  const totalFailAll = jobs.reduce((a, j) => a + j.failureCount, 0);

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Signature Silaer Dynamic Header Banner */}
      <div className="bg-gradient-to-r from-primary/15 via-primary/5 to-card border border-primary/20 rounded-2xl p-5 md:p-6 shadow-xs relative overflow-hidden transition-colors duration-300">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start sm:items-center gap-4">
            <div className="h-11 w-11 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0 border border-primary/25 shadow-xs">
              <FileUp className="h-5 w-5" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                  Import History & Lead Ingestion Diagnostics
                </h1>
              </div>
              <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                Audit log of all bulk contact import sessions, error stream downloads, and transactional rollbacks.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-start md:self-center">
            <Button variant="outline" size="sm" onClick={() => fetchJobs(pagination.page)} disabled={isLoading} className="rounded-xl border border-border bg-card/80 text-xs font-semibold shadow-2xs hover:bg-primary/10">
              <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5 text-primary", isLoading && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="shadow-sm">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="bg-primary/10 p-3 rounded-lg"><Database className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total Jobs</p>
                <p className="text-2xl font-bold">{pagination.total}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="bg-emerald-500/10 p-3 rounded-lg"><Users className="h-5 w-5 text-emerald-600" /></div>
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Contacts Saved</p>
                <p className="text-2xl font-bold text-emerald-600">{totalSuccessAll.toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="bg-red-500/10 p-3 rounded-lg"><AlertTriangle className="h-5 w-5 text-red-500" /></div>
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Failed Rows</p>
                <p className="text-2xl font-bold text-red-500">{totalFailAll.toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Jobs Table */}
        <Card className="shadow-sm border-border">
          <CardHeader className="border-b border-border bg-muted/20 pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <FileUp className="h-4 w-4 text-muted-foreground" />
              All Import Sessions
            </CardTitle>
            <CardDescription>
              &quot;Download Errors&quot; fetches failed rows as a CSV stream — never loads all errors into memory.
              &quot;Revert&quot; deletes all data created by that import inside a DB transaction.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-10 text-center text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
                Loading import history...
              </div>
            ) : jobs.length === 0 ? (
              <div className="p-16 text-center flex flex-col items-center">
                <FileUp className="h-10 w-10 text-muted-foreground/20 mb-3" />
                <p className="font-medium text-muted-foreground">No import jobs yet</p>
                <p className="text-sm text-muted-foreground mt-1">History appears here after the first bulk import.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {jobs.map((job) => (
                  <div key={job.id} className="p-5 flex flex-col sm:flex-row sm:items-center gap-4 hover:bg-muted/10 transition-colors">
                    {/* Left: File info */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-foreground truncate max-w-[220px]">{job.fileName}</span>
                        <StatusBadge status={job.status} />
                        {job.importTag && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                            {job.importTag}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                        <span>{job.users?.name || job.users?.email || "Unknown"}</span>
                        <span>·</span>
                        <span>{formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}</span>
                        {job.completedAt && (
                          <><span>·</span><span>Done {format(new Date(job.completedAt), "HH:mm:ss")}</span></>
                        )}
                        {job.revertedAt && (
                          <><span>·</span><span className="text-orange-500 font-medium">Reverted {format(new Date(job.revertedAt), "MMM d")}</span></>
                        )}
                        {job.campaignName && (
                          <><span>·</span><span className="font-medium">{job.campaignName}</span></>
                        )}
                      </div>
                    </div>

                    {/* Middle: Stats */}
                    <div className="flex gap-4 text-sm shrink-0">
                      <div className="text-center">
                        <p className="font-bold text-emerald-600">{job.successCount.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Saved</p>
                      </div>
                      <div className="text-center">
                        <p className="font-bold text-muted-foreground">{job.skippedCount.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Skipped</p>
                      </div>
                      <div className="text-center">
                        <p className={cn("font-bold", job.failureCount > 0 ? "text-destructive" : "text-muted-foreground")}>
                          {job.failureCount.toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground">Failed</p>
                      </div>
                      <div className="text-center">
                        <p className="font-bold text-foreground">{job.totalRows.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Total</p>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex gap-2 shrink-0">
                      {job.failureCount > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs gap-1.5"
                          onClick={() => handleDownloadErrors(job)}
                        >
                          <Download className="h-3.5 w-3.5" />
                          Errors
                        </Button>
                      )}
                      {(job.status === "COMPLETED" || job.status === "FAILED") && job.campaignId && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/5"
                          onClick={() => handleRevert(job)}
                          disabled={revertingId === job.id}
                        >
                          {revertingId === job.id
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <RotateCcw className="h-3.5 w-3.5" />
                          }
                          Revert
                        </Button>
                      )}
                      {job.failureCount === 0 && job.status === "REVERTED" && (
                        <span className="text-xs text-muted-foreground px-2 self-center">Reverted</span>
                      )}
                      {job.failureCount === 0 && job.status === "COMPLETED" && (
                        <span className="text-xs text-muted-foreground px-2 self-center">Clean import</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-border">
                <p className="text-sm text-muted-foreground">
                  Page {pagination.page} of {pagination.totalPages} · {pagination.total} total jobs
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={pagination.page <= 1}
                    onClick={() => fetchJobs(pagination.page - 1)}>Previous</Button>
                  <Button variant="outline" size="sm" disabled={pagination.page >= pagination.totalPages}
                    onClick={() => fetchJobs(pagination.page + 1)}>Next</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
    </div>
  );
}
