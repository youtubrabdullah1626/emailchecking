"use client";

import React from "react";
import useSWR from "swr";
import { LegacyBadge as Badge, LegacyLoadingState as LoadingState, LegacyErrorState as ErrorState } from "@/components/ui/legacy-adapters";
import { LegacyPageHeader as PageHeader } from "@/components/ui/legacy-adapters";
import { Card, CardContent, Table, TableHead, TableRow, TableHeader, TableBody, TableCell } from "@/components/ui";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function OperationsDashboard() {
  const { data: diagData, error: diagError } = useSWR("/api/observability/diagnostics", fetcher, { refreshInterval: 10000 });
  const { data: connData, error: connError } = useSWR("/api/observability/connections", fetcher, { refreshInterval: 10000 });
  const { data: metricsData, error: metricsError } = useSWR("/api/observability/metrics", fetcher, { refreshInterval: 10000 });
  const { data: auditData, error: auditError } = useSWR("/api/observability/audit", fetcher, { refreshInterval: 10000 });
  const { data: errorsData, error: sysErrorError } = useSWR("/api/observability/errors", fetcher, { refreshInterval: 10000 });

  const isLoading = !diagData || !connData || !metricsData || !auditData || !errorsData;
  const hasError = diagError || connError || metricsError || auditError || sysErrorError;

  if (hasError) {
    return (
      <div className="p-8">
        <ErrorState 
          title="Dashboard Error" 
          message="Failed to load observability data. Ensure backend systems are reachable."
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-8">
        <LoadingState message="Loading Enterprise Observability..." />
      </div>
    );
  }

  const { health, diagnostics } = diagData;
  const connections = connData.connections || [];
  const metrics = metricsData.metrics || {};
  const logs = auditData.data || [];
  const errors = errorsData.data || [];

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "HEALTHY":
      case "CONNECTED":
      case "OPERATIONAL":
      case "ACTIVE":
        return "success";
      case "WARNING":
      case "WATCH_EXPIRING":
        return "warning";
      case "DEGRADED":
      case "NEEDS_RECONNECT":
      case "CRITICAL":
      case "WATCH_EXPIRED":
        return "danger";
      default:
        return "neutral";
    }
  };

  return (
    <div className="flex-1 space-y-8 p-8 pt-6">
      <PageHeader
        title="Enterprise Operations"
        description="Global monitoring, telemetry, and system health operations."
        actions={
          <Badge variant={getStatusVariant(health.overall) as any}>
            System Status: {health.overall}
          </Badge>
        }
      />

      <div className="flex flex-col gap-8">
        
        {/* Live Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {[
            { label: "Emails Sent (Today)", value: metrics.emailsSentToday },
            { label: "Emails Sent (Total)", value: metrics.emailsSentTotal },
            { label: "Replies Detected", value: metrics.repliesTotal },
            { label: "Reply Rate", value: `${metrics.replyRate.toFixed(1)}%` },
            { label: "Active Sequences", value: metrics.activeSequences },
            { label: "Errors (24h)", value: metrics.systemErrors24h },
          ].map(m => (
            <Card key={m.label}>
              <CardContent className="p-4">
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-muted-foreground">{m.label}</span>
                  <span className="text-3xl font-bold text-foreground">{m.value}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          <div className="flex flex-col gap-6 lg:col-span-2">
            
            {/* Subsystem Health */}
            <Card>
              <CardContent className="p-6">
                <h2 className="text-xl font-semibold mb-6 text-foreground">Subsystem Health</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {Object.entries(health.components).map(([name, comp]: [string, any]) => (
                    <div key={name} className="flex justify-between items-center p-4 bg-muted/50 rounded-md border border-border">
                      <span className="capitalize font-medium text-foreground">
                        {name.replace(/([A-Z])/g, ' $1')}
                      </span>
                      <Badge variant={getStatusVariant(comp.status) as any}>{comp.status}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Connected Accounts */}
            <Card>
              <CardContent className="p-6">
                <h2 className="text-xl font-semibold mb-6 text-foreground">
                  Connected Gmail Accounts ({connections.length})
                </h2>
                {connections.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No accounts connected.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Email</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Sent Today</TableHead>
                          <TableHead>Watch Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {connections.map((conn: any) => (
                          <TableRow key={conn.email}>
                            <TableCell className="font-medium text-foreground">{conn.email}</TableCell>
                            <TableCell>
                              <Badge variant={getStatusVariant(conn.status) as any}>{conn.status}</Badge>
                            </TableCell>
                            <TableCell>{conn.sentToday} / {conn.dailyLimit}</TableCell>
                            <TableCell>
                              <Badge variant={conn.watch ? getStatusVariant(conn.watch.status) as any : "neutral"}>
                                {conn.watch ? conn.watch.status : "NO_WATCH"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

          </div>

          <div className="flex flex-col gap-6">
            
            {/* Diagnostics */}
            <Card>
              <CardContent className="p-6">
                <h2 className="text-xl font-semibold mb-6 text-foreground">Diagnostics</h2>
                <div className="flex flex-col gap-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Last Send:</span>
                    <span className="text-sm font-medium text-foreground">{diagnostics.lastSuccessfulSend ? new Date(diagnostics.lastSuccessfulSend).toLocaleString() : "Never"}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Last Reply Scan:</span>
                    <span className="text-sm font-medium text-foreground">{diagnostics.lastReplyScan ? new Date(diagnostics.lastReplyScan).toLocaleString() : "Never"}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Pending Jobs:</span>
                    <Badge variant="neutral">{diagnostics.pendingJobs}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Memory Usage:</span>
                    <span className="text-sm font-medium text-foreground">{health.metrics.memoryUsageMb} MB</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Error Feed */}
            <Card className="flex-1 flex flex-col">
              <CardContent className="flex-1 flex flex-col p-6">
                <h2 className="text-xl font-semibold mb-6 text-destructive">Error Feed</h2>
                <div className="flex-1 max-h-[300px] overflow-y-auto flex flex-col gap-4 pr-2">
                  {errors.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No recent errors.</p>
                  ) : (
                    errors.map((err: any) => (
                      <div key={err.id} className="flex flex-col gap-2 p-4 bg-muted/50 rounded-md border-l-4 border-l-destructive">
                        <span className="text-sm font-semibold text-destructive">[{err.errorType}] {err.service}</span>
                        <span className="text-sm text-destructive/80">{err.message}</span>
                        <div className="flex justify-between items-center mt-1">
                          <span className="text-xs text-muted-foreground">Count: {err.count}</span>
                          <span className="text-xs text-muted-foreground">{new Date(err.lastSeen).toLocaleString()}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

          </div>
        </div>

        {/* Audit Timeline */}
        <Card>
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold mb-6 text-foreground">Audit Timeline</h2>
            <div className="max-h-[400px] overflow-y-auto pr-2">
              {logs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No audit events found.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Request ID</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log: any) => (
                      <TableRow key={log.id}>
                        <TableCell className="whitespace-nowrap text-muted-foreground">{new Date(log.created_at).toLocaleString()}</TableCell>
                        <TableCell className="font-medium text-foreground">{log.action}</TableCell>
                        <TableCell>
                          <Badge variant={log.action_type === "SYSTEM_ACTION" ? "info" : "success"}>
                            {log.action_type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <code className="bg-muted px-1.5 py-0.5 rounded text-xs text-muted-foreground">
                            {log.metadata?.requestId?.slice(0,8) || "-"}
                          </code>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
