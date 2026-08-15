"use client";

import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui";
import { LegacyBadge as Badge, LegacyButton as Button } from "@/components/ui/legacy-adapters";
import { toast } from "sonner";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { MoreVertical, Activity, Zap, ShieldAlert, Unlink, Link2, Trash2 } from "lucide-react";

export interface ConnectedAccountProps {
  email: string;
  userId: string | null;
  connectionStatus: string;
  healthStatus: "HEALTHY" | "SYNCING" | "EXPIRING_SOON" | "EXPIRED" | "NEEDS_RECONNECT" | "DISCONNECTED";
  historyId: string | null;
  expiresAt: string | null;
  msUntilExpiry: number | null;
  needsWatchRenewal: boolean;
  errorCount: number;
  lastError: string | null;
  lastSyncedAt: string | null;
  sentToday: number;
  dailyLimit?: number;
  warmupStage?: "DAY_1_3" | "DAY_4_7" | "MATURE" | "COMPLETED";
  warmupStatus?: string;
  ageInDays?: number;
  replyCount: number;
  lastEmailSentAt: string | null;
  lastReplyDetectedAt: string | null;
  healthScore: number;
  onAccountUpdated?: () => void;
}

function ConnectedAccountCardComponent({
  account,
  onAccountUpdated,
}: {
  account: ConnectedAccountProps;
  onAccountUpdated?: () => void;
}) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const handleAction = async (action: "TEST_CONNECTION" | "RENEW_WATCH" | "SYNC_NOW" | "DISCONNECT" | "DELETE_ACCOUNT") => {
    setActionLoading(action);
    try {
      const res = await fetch("/api/gmail/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: account.email, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.error || "Action failed.");

      toast.success(data.message);
      if (onAccountUpdated) onAccountUpdated();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Action failed.";
      toast.error(msg);
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = () => {
    if (account.connectionStatus === "DISCONNECTED") return <Badge variant="neutral">⚫ Disconnected</Badge>;
    if (account.healthStatus === "HEALTHY") return <Badge variant="success">🟢 Healthy</Badge>;
    if (account.healthStatus === "EXPIRING_SOON") return <Badge variant="warning">🟡 Expiring Soon</Badge>;
    return <Badge variant="danger">🔴 Needs Reconnect</Badge>;
  };

  const maxLimit = account.dailyLimit || 50;
  const percentUsed = Math.min(100, Math.round((account.sentToday / maxLimit) * 100));

  const getRampUpBadge = () => {
    if (account.warmupStage === "DAY_1_3") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
          🔥 Warmup Ramp: {maxLimit}/day (Days 1–3)
        </span>
      );
    }
    if (account.warmupStage === "DAY_4_7") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
          📈 Growth Ramp: {maxLimit}/day (Days 4–7)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
        ⚡ Full Capacity: {maxLimit}/day
      </span>
    );
  };

  return (
    <Card className="hover-elevate transition-all relative border border-border/70 shadow-sm bg-card">
      <div className="absolute top-4 right-4 z-10">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" disabled={actionLoading !== null}>
              <MoreVertical className="h-4 w-4" />
              <span className="sr-only">Open menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={() => handleAction("SYNC_NOW")} disabled={actionLoading !== null}>
              <Zap className="mr-2 h-4 w-4" />
              <span>Sync Now</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {account.connectionStatus === "CONNECTED" ? (
              <DropdownMenuItem onClick={() => handleAction("DISCONNECT")} disabled={actionLoading !== null}>
                <Unlink className="mr-2 h-4 w-4" />
                <span>Disconnect</span>
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem asChild>
                <a href="/api/auth/gmail" className="cursor-pointer">
                  <Link2 className="mr-2 h-4 w-4" />
                  <span>Reconnect Gmail</span>
                </a>
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => {
                if (window.confirm(`⚠️ Are you sure you want to permanently delete ${account.email}? Active sequence follow-ups locked to this inbox will be automatically reassigned to your other active inboxes. This action cannot be undone.`)) {
                  handleAction("DELETE_ACCOUNT");
                }
              }}
              disabled={actionLoading !== null}
              className="text-destructive focus:text-destructive focus:bg-destructive/10"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              <span>Delete Account</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <CardContent className="p-6">
        <div className="flex flex-col gap-5">
          {/* Header Row */}
          <div className="flex flex-wrap items-center justify-between gap-4 pr-8">
            <div className="flex items-center gap-4">
              <div
                className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary/70 text-primary-foreground flex items-center justify-center text-lg font-bold shadow-sm"
              >
                {account.email.charAt(0).toUpperCase()}
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-lg font-bold text-foreground">
                  {account.email}
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {account.connectionStatus === "CONNECTED" ? "OAuth 2.0 Connected" : "OAuth 2.0 Disconnected"}
                  </span>
                  {account.connectionStatus === "CONNECTED" && (
                    <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                      🔄 Active in Rotation Pool
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              {getRampUpBadge()}
              {getStatusBadge()}
            </div>
          </div>

          {/* Capacity Progress Bar */}
          <div className="space-y-2 bg-muted/30 p-3.5 rounded-xl border border-border/40">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-primary" /> Daily Sending Capacity
              </span>
              <span className="text-muted-foreground font-medium">
                <strong className="text-foreground">{account.sentToday}</strong> / {maxLimit} sent today ({percentUsed}%)
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div 
                className={`h-full transition-all rounded-full ${percentUsed >= 90 ? 'bg-amber-500' : 'bg-primary'}`}
                style={{ width: `${percentUsed}%` }}
              />
            </div>
          </div>

          {/* Stats Footer Row */}
          <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-muted-foreground border-t border-border/50 pt-3">
            <div className="flex items-center gap-4">
              <span>Health Score: <strong className="text-foreground">{account.healthScore}%</strong></span>
              <span>•</span>
              <span>Hourly Max: <strong className="text-foreground">15 / hr</strong></span>
            </div>
            <span className="text-[11px] text-muted-foreground/80">
              Auto-resets at local midnight
            </span>
          </div>

        </div>
      </CardContent>
    </Card>
  );
}

export default React.memo(ConnectedAccountCardComponent);
