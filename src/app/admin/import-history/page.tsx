"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { AnimatedPage } from "@/components/ui/animated";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  FileUp, Users, CheckCircle2, XCircle, Clock, AlertTriangle,
  SkipForward, Download, RefreshCw, Database
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
  campaignName: string | null;
  importTag: string | null;
  chunksTotal: number;
  chunksLoaded: number;
  createdAt: string;
  completedAt: string | null;
  users: { name: string | null; email: string | null };
  errorLog: any;
};

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string; icon: any }> = {
    COMPLETED: { label: "Completed", className: "bg-emerald-500/10 text-emerald-600 border-emerald-200", icon: CheckCircle2 },
    PROCESSING: { label: "Processing", className: "bg-blue-500/10 text-blue-600 border-blue-200", icon: Clock },
    PENDING:    { label: "Pending",    className: "bg-amber-500/10 text-amber-600 border-amber-200",  icon: Clock },
    FAILED:     { label: "Failed",     className: "bg-red-500/10 text-red-600 border-red-200",         icon: XCircle },
    ABORTED:    { label: "Aborted",    className: "bg-gray-500/10 text-gray-600 border-gray-200",      icon: XCircle },
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

function downloadErrorCsv(job: ImportJob) {
  const errors: any[] = Array.isArray(job.errorLog) ? job.errorLog : [];
  if (errors.length === 0) {
    toast.info("No errors to download for this import.");
    return;
  }
  const header = "Row,Email,Reason\n";
  const rows = errors.map((e: any) => `${e.row ?? ""},${e.email ?? ""},${e.reason ?? ""}`).join("\n");
  const blob = new Blob([header + rows], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `import-errors-${job.id.slice(0, 8)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success("Error report downloaded.");
}

export default function ImportHistoryAdminPage() {
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });

  const fetchJobs = async (page = 1) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/admin/import-history?page=${page}&limit=20`);
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

  const totalSuccessAll = jobs.reduce((a, j) => a + j.successCount, 0);
  const totalFailAll = jobs.reduce((a, j) => a + j.failureCount, 0);

  return (
    <div className="flex-1 p-8 pt-6">
      <AnimatedPage className="space-y-8">
        <div className="flex items-center justify-between">
          <PageHeader
            title="Import History"
            description="Full audit log of all bulk contact import sessions across all users."
          />
          <Button variant="outline" size="sm" onClick={() => fetchJobs(pagination.page)} disabled={isLoading}>
            <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
            Refresh
          </Button>
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
              Each row represents one bulk import session. Click "Download Errors" to get the failed rows as a CSV.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-10 text-center text-muted-foreground animate-pulse">Loading import history...</div>
            ) : jobs.length === 0 ? (
              <div className="p-16 text-center flex flex-col items-center">
                <FileUp className="h-10 w-10 text-muted-foreground/20 mb-3" />
                <p className="font-medium text-muted-foreground">No import jobs yet</p>
                <p className="text-sm text-muted-foreground mt-1">Import history will appear here after the first bulk import.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {jobs.map((job) => (
                  <div key={job.id} className="p-5 flex flex-col sm:flex-row sm:items-center gap-4 hover:bg-muted/10 transition-colors">
                    {/* Left: File + User info */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-foreground truncate max-w-[240px]">{job.fileName}</span>
                        <StatusBadge status={job.status} />
                        {job.importTag && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                            {job.importTag}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        <span>{job.users?.name || job.users?.email || "Unknown user"}</span>
                        <span>·</span>
                        <span>{formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}</span>
                        {job.completedAt && (
                          <>
                            <span>·</span>
                            <span>Finished {format(new Date(job.completedAt), "HH:mm:ss")}</span>
                          </>
                        )}
                        {job.campaignName && (
                          <>
                            <span>·</span>
                            <span className="font-medium">{job.campaignName}</span>
                          </>
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
                    <div className="shrink-0">
                      {job.failureCount > 0 ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs gap-1.5"
                          onClick={() => downloadErrorCsv(job)}
                        >
                          <Download className="h-3.5 w-3.5" />
                          Error Report
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground px-2">No errors</span>
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
                  <Button
                    variant="outline" size="sm"
                    disabled={pagination.page <= 1}
                    onClick={() => fetchJobs(pagination.page - 1)}
                  >Previous</Button>
                  <Button
                    variant="outline" size="sm"
                    disabled={pagination.page >= pagination.totalPages}
                    onClick={() => fetchJobs(pagination.page + 1)}
                  >Next</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </AnimatedPage>
    </div>
  );
}
