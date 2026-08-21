"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, RefreshCw, Unlink, Link2, Trash2, Mail } from "lucide-react";

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

  const maxLimit = account.dailyLimit || 50;
  const percentUsed = Math.min(100, Math.round((account.sentToday / maxLimit) * 100));
  const isHealthy = account.connectionStatus === "CONNECTED" && account.healthStatus === "HEALTHY";

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-2xs hover:border-border/80 transition-all space-y-4">
      {/* Top Header Row */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-9 w-9 rounded-lg bg-muted/60 border border-border/80 flex items-center justify-center shrink-0 text-foreground font-semibold">
            <Mail className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-semibold text-sm text-foreground truncate">
              {account.email}
            </span>
            <span className="relative flex h-2 w-2 shrink-0">
              {isHealthy && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />}
              <span className={`relative inline-flex rounded-full h-2 w-2 ${isHealthy ? 'bg-emerald-500' : 'bg-destructive'}`} />
            </span>
          </div>
        </div>

        {/* 3-Dots Action Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0" disabled={actionLoading !== null}>
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">Open menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 text-xs">
            <DropdownMenuItem onClick={() => handleAction("SYNC_NOW")} disabled={actionLoading !== null} className="gap-2">
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Sync Mailbox Now</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {account.connectionStatus === "CONNECTED" ? (
              <DropdownMenuItem onClick={() => handleAction("DISCONNECT")} disabled={actionLoading !== null} className="gap-2">
                <Unlink className="h-3.5 w-3.5" />
                <span>Disconnect Inbox</span>
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem asChild className="gap-2">
                <a href="/api/auth/gmail" className="cursor-pointer">
                  <Link2 className="h-3.5 w-3.5" />
                  <span>Reconnect Gmail</span>
                </a>
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => {
                if (window.confirm(`⚠️ Permanently remove ${account.email}? Active sequence follow-ups will safely fallback to your remaining active inboxes.`)) {
                  handleAction("DELETE_ACCOUNT");
                }
              }}
              disabled={actionLoading !== null}
              className="text-destructive focus:text-destructive focus:bg-destructive/10 gap-2"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Delete Account</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Sending Capacity Progress */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground font-medium">Daily Outbound Capacity</span>
          <span className="font-mono text-xs text-foreground font-semibold">
            {account.sentToday} / {maxLimit} sent today <span className="text-muted-foreground font-normal">({percentUsed}%)</span>
          </span>
        </div>
        <div className="w-full bg-muted/60 rounded-full h-1.5 overflow-hidden">
          <div 
            className={`h-full transition-all rounded-full ${percentUsed >= 90 ? 'bg-amber-500' : 'bg-primary'}`}
            style={{ width: `${percentUsed}%` }}
          />
        </div>
      </div>

      {/* Footer Metadata */}
      <div className="flex items-center justify-between pt-3 border-t border-border/60 text-xs text-muted-foreground font-mono">
        <div className="flex items-center gap-3 text-[11px]">
          <span>Max Velocity: <strong className="text-foreground">15/hr</strong></span>
        </div>
        <span className="text-[11px] text-muted-foreground">
          Auto-resets at midnight
        </span>
      </div>
    </div>
  );
}

export default React.memo(ConnectedAccountCardComponent);
