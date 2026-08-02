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

  const daysRemaining = account.msUntilExpiry
    ? Math.max(0, Math.floor(account.msUntilExpiry / (1000 * 60 * 60 * 24)))
    : null;

  return (
    <Card className="hover-elevate transition-shadow relative">
      <div className="absolute top-4 right-4 z-10">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" disabled={actionLoading !== null}>
              <MoreVertical className="h-4 w-4" />
              <span className="sr-only">Open menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={() => handleAction("TEST_CONNECTION")} disabled={actionLoading !== null}>
              <Activity className="mr-2 h-4 w-4" />
              <span>Test Connection</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleAction("SYNC_NOW")} disabled={actionLoading !== null}>
              <Zap className="mr-2 h-4 w-4" />
              <span>Sync Now</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleAction("RENEW_WATCH")} disabled={actionLoading !== null}>
              <ShieldAlert className="mr-2 h-4 w-4" />
              <span>Renew Watch</span>
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
                if (window.confirm(`Are you sure you want to permanently delete ${account.email}? This action cannot be undone.`)) {
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
        <div className="flex flex-col gap-6">
          
          <div className="flex flex-wrap items-center justify-between gap-4">
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
                <span className="text-sm text-muted-foreground">
                  {account.connectionStatus === "CONNECTED" ? "OAuth 2.0 Connected" : "OAuth 2.0 Disconnected"} • History ID: <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{account.historyId || "None"}</code>
                </span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {getStatusBadge()}
              <div className="text-sm font-semibold px-3 py-1 rounded-md bg-muted text-muted-foreground hidden sm:block">
                Health Score: {account.healthScore}%
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6 mt-2 text-sm text-muted-foreground border-t border-border/50 pt-4">
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-foreground">{account.sentToday}</span>
              <span>emails sent today</span>
            </div>
            {daysRemaining !== null && (
              <div className="flex items-center gap-1.5">
                <span>Watch expires in</span>
                <span className={`font-medium ${daysRemaining <= 1 ? 'text-destructive' : 'text-foreground'}`}>
                  {daysRemaining} days
                </span>
              </div>
            )}
          </div>

        </div>
      </CardContent>
      
    </Card>
  );
}

export default React.memo(ConnectedAccountCardComponent);
