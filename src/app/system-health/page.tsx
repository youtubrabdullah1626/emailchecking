"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Mail, 
  RefreshCw, 
  Zap,
  Activity,
  ServerCog,
  ShieldCheck,
  Search
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { AnimatedPage, AnimatedList, AnimatedItem } from "@/components/ui/animated";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { ConnectedAccountProps } from "@/components/ConnectedAccountCard";

interface SystemHealthSummary {
  ok: boolean;
  totalAccounts: number;
  healthyCount: number;
  expiringCount: number;
  expiredCount: number;
  reconnectCount: number;
  accounts: ConnectedAccountProps[];
  systemHealth: "HEALTHY" | "ATTENTION_NEEDED" | "DEGRADED";
  capturedAt: string;
}

export default function SystemHealthPage() {
  const [healthData, setHealthData] = useState<SystemHealthSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [repairing, setRepairing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadHealth = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/gmail/health");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || data.error || "Failed to load system health metrics.");
      }
      const data = await res.json();
      setHealthData(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load system health.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHealth();
  }, [loadHealth]);

  const handleSelfHealingSweep = async () => {
    setRepairing(true);
    try {
      const res = await fetch("/api/gmail/health", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ systemWide: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.error || "Self-healing sweep failed.");
      
      toast.success(`Self-healing sweep completed. Processed ${data.accountsRepaired ?? 0} account(s).`);
      await loadHealth();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Self-healing sweep failed.";
      toast.error(msg);
    } finally {
      setRepairing(false);
    }
  };

  const handleAccountAction = async (email: string, action: "TEST_CONNECTION" | "RENEW_WATCH" | "SYNC_NOW" | "DISCONNECT") => {
    setActionLoading(`${email}-${action}`);
    try {
      const res = await fetch("/api/gmail/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.error || "Action failed.");

      toast.success(data.message);
      await loadHealth();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Action failed.";
      toast.error(msg);
    } finally {
      setActionLoading(null);
    }
  };

  const getOverallStatusBanner = () => {
    if (!healthData) return null;
    
    if (healthData.systemHealth === 'HEALTHY') {
      return {
        bg: 'bg-emerald-50 border-emerald-200 text-emerald-800',
        icon: <CheckCircle2 className="h-6 w-6 text-emerald-600" />,
        text: 'System is healthy'
      };
    }
    if (healthData.systemHealth === 'ATTENTION_NEEDED') {
      return {
        bg: 'bg-amber-50 border-amber-200 text-amber-800',
        icon: <AlertTriangle className="h-6 w-6 text-amber-600" />,
        text: 'System needs attention'
      };
    }
    return {
      bg: 'bg-red-50 border-red-200 text-red-800',
      icon: <XCircle className="h-6 w-6 text-red-600" />,
      text: 'System is degraded'
    };
  };

  const banner = getOverallStatusBanner();

  const systemMetrics = healthData ? [
    { name: 'Connected Accounts', value: healthData.totalAccounts, icon: <Mail className="h-5 w-5" />, status: healthData.totalAccounts > 0 ? 'healthy' : 'degraded' },
    { name: 'Healthy Mailboxes', value: healthData.healthyCount, icon: <ShieldCheck className="h-5 w-5" />, status: healthData.healthyCount === healthData.totalAccounts ? 'healthy' : 'degraded' },
    { name: 'Expiring Soon', value: healthData.expiringCount, icon: <AlertTriangle className="h-5 w-5" />, status: healthData.expiringCount > 0 ? 'degraded' : 'healthy' }
  ] : [];

  const backgroundWorkers = [
    { name: 'Gmail Push Webhook', status: 'healthy', icon: <Activity className="h-5 w-5" />, info: 'PubSub receiver active at /api/webhooks/gmail' },
    { name: '15-Min Reply Scanner', status: 'healthy', icon: <Search className="h-5 w-5" />, info: 'Fallback cron safety net at /api/cron/scheduler' },
    { name: 'Daily Watch Auto-Renewal', status: 'healthy', icon: <ServerCog className="h-5 w-5" />, info: 'Automated sweep at 06:00 UTC' }
  ];

  return (
    <AnimatedPage className="space-y-6">
      <PageHeader 
        title="System Health" 
        description="Monitor the operational status of all internal services and integrations."
      >
        <div className="flex flex-wrap gap-3">
          <Button 
            variant="outline" 
            className="gap-2" 
            onClick={handleSelfHealingSweep}
            disabled={repairing || loading}
          >
            {repairing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            Run Self-Healing Sweep
          </Button>
          <Button 
            variant="outline" 
            className="gap-2" 
            onClick={loadHealth}
            disabled={loading || repairing}
          >
            <RefreshCw className={`h-4 w-4 ${loading && !healthData ? 'animate-spin' : ''}`} /> 
            Refresh Status
          </Button>
        </div>
      </PageHeader>

      {!loading && healthData && banner && (
        <div className={`p-4 rounded-xl border flex items-center gap-3 ${banner.bg}`}>
          {banner.icon}
          <div>
            <h3 className="font-semibold capitalize">{banner.text}</h3>
            <p className="text-sm opacity-90">Last checked {format(new Date(healthData.capturedAt), "h:mm:ss a")}</p>
          </div>
        </div>
      )}

      {loading && !healthData ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-32 bg-muted rounded-xl animate-pulse" />)}
        </div>
      ) : healthData ? (
        <div className="space-y-12">
          
          {/* Section: Core Metrics & Background Workers */}
          <section>
            <h2 className="text-xl font-semibold mb-4">Core Services & Background Workers</h2>
            <AnimatedList className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...systemMetrics, ...backgroundWorkers].map((service, i) => (
                <AnimatedItem key={i}>
                  <Card className="hover-elevate transition-shadow border-border h-full">
                    <CardContent className="p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-muted rounded-lg text-muted-foreground">
                            {service.icon}
                          </div>
                          <h3 className="font-semibold text-foreground">{service.name}</h3>
                        </div>
                        <StatusBadge status={service.status as any} dot />
                      </div>
                      
                      <div className="space-y-3 mt-6">
                        {'value' in service ? (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Current Count</span>
                            <span className="font-medium text-foreground">{service.value}</span>
                          </div>
                        ) : (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Configuration</span>
                            <span className="font-medium text-foreground text-right max-w-[200px] truncate" title={service.info}>{service.info}</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </AnimatedItem>
              ))}
            </AnimatedList>
          </section>

          {/* Section: Connected Mailboxes */}
          <section>
            <h2 className="text-xl font-semibold mb-4">Connected Mailboxes ({healthData.accounts.length})</h2>
            {healthData.accounts.length === 0 ? (
              <div className="text-center py-12 border border-dashed rounded-xl border-border bg-muted/30">
                <Mail className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No Mailboxes Connected</h3>
                <p className="text-muted-foreground mb-4 max-w-sm mx-auto">
                  Connect a Gmail account to enable outreach sending and reply tracking.
                </p>
                <Button variant="outline" asChild>
                  <a href="/api/auth/gmail">Connect Gmail Account</a>
                </Button>
              </div>
            ) : (
              <AnimatedList className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {healthData.accounts.map((acc, i) => (
                  <AnimatedItem key={i}>
                    <Card className="hover-elevate transition-shadow border-border h-full flex flex-col">
                      <CardContent className="p-6 flex-1 flex flex-col">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-lg">
                              {acc.email.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <h3 className="font-semibold text-foreground truncate max-w-[200px] sm:max-w-xs">{acc.email}</h3>
                              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                History ID: {acc.historyId || "Initializing"}
                              </p>
                            </div>
                          </div>
                          <StatusBadge 
                            status={acc.healthStatus === "HEALTHY" ? "healthy" : acc.healthStatus === "EXPIRING_SOON" ? "degraded" : "error"} 
                            dot 
                          />
                        </div>

                        <div className="space-y-3 mt-4 flex-1">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Watch Expiration</span>
                            <span className={`font-medium ${acc.msUntilExpiry && acc.msUntilExpiry <= 86400000 ? 'text-red-500' : 'text-foreground'}`}>
                              {acc.msUntilExpiry ? `${Math.max(0, Math.floor(acc.msUntilExpiry / (1000 * 60 * 60 * 24)))} days left` : "Not Registered"}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Sent Today</span>
                            <span className="font-medium text-foreground">{acc.sentToday} emails</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Replies Tracked</span>
                            <span className="font-medium text-emerald-600">{acc.replyCount} replies</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Last Sync</span>
                            <span className="font-medium text-foreground">
                              {acc.lastSyncedAt ? formatDistanceToNow(new Date(acc.lastSyncedAt), { addSuffix: true }) : "Just now"}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 mt-6 pt-4 border-t border-border">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="flex-1 text-xs"
                            disabled={!!actionLoading}
                            onClick={() => handleAccountAction(acc.email, "TEST_CONNECTION")}
                          >
                            {actionLoading === `${acc.email}-TEST_CONNECTION` ? <RefreshCw className="h-3 w-3 mr-1 animate-spin" /> : "Test"}
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="flex-1 text-xs"
                            disabled={!!actionLoading}
                            onClick={() => handleAccountAction(acc.email, "SYNC_NOW")}
                          >
                            {actionLoading === `${acc.email}-SYNC_NOW` ? <RefreshCw className="h-3 w-3 mr-1 animate-spin" /> : "Sync"}
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="flex-1 text-xs"
                            disabled={!!actionLoading}
                            onClick={() => handleAccountAction(acc.email, "RENEW_WATCH")}
                          >
                            {actionLoading === `${acc.email}-RENEW_WATCH` ? <RefreshCw className="h-3 w-3 mr-1 animate-spin" /> : "Renew"}
                          </Button>
                          {acc.connectionStatus === "CONNECTED" ? (
                            <Button 
                              variant="destructive" 
                              size="sm" 
                              className="flex-1 text-xs bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
                              disabled={!!actionLoading}
                              onClick={() => handleAccountAction(acc.email, "DISCONNECT")}
                            >
                              {actionLoading === `${acc.email}-DISCONNECT` ? <RefreshCw className="h-3 w-3 mr-1 animate-spin" /> : "Disconnect"}
                            </Button>
                          ) : (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="flex-1 text-xs"
                              asChild
                            >
                              <a href="/api/auth/gmail">Reconnect</a>
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </AnimatedItem>
                ))}
              </AnimatedList>
            )}
          </section>

        </div>
      ) : null}
    </AnimatedPage>
  );
}
