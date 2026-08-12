"use client";

import { useState } from "react";
import { usePlatformFlags } from "../../hooks/usePlatformFlags";
import { ApiFeatureFlag } from "../../hooks/types";
import { ConfigurationRow } from "../shared/ConfigurationRow";
import { StatusBadge } from "@/components/ui/status-badge";
import { RiskBadge } from "../shared/RiskBadge";
import { formatRollout } from "../../hooks/types";

interface FeatureFlagsTabProps {
  onSelect: (item: ApiFeatureFlag) => void;
}

function getInfoText(key: string): string | undefined {
  switch (key) {
    case "SCHEDULER_ENABLED":
      return "Example: If disabled, the system will completely stop claiming and sending sequence emails in the background. Useful if you need to pause all sending globally.";
    case "SMART_IMPORT_ENABLED":
      return "Example: If disabled, the 'Import Contacts' button in the dashboard will be hidden, preventing all users from uploading new CSVs.";
    case "EMAIL_TRACKING_ENABLED":
      return "Example: If disabled, tracking pixels will not be embedded in sent emails, and open/click tracking will stop functioning for all users.";
    case "WARMUP_ENABLED":
      return "Example: If disabled, the platform will stop sending automated warmup emails designed to improve domain reputation.";
    case "REPLY_SCANNER_ENABLED":
      return "Example: If disabled, the system will stop listening to incoming Gmail replies. Sequences will not pause automatically when a prospect replies.";
    case "MAINTENANCE_MODE":
      return "Example: If enabled, all regular users will be locked out and see a 'Down for maintenance' screen. Background jobs will be suspended.";
    default:
      return undefined;
  }
}

export function FeatureFlagsTab({ onSelect }: FeatureFlagsTabProps) {
  const { flags, isLoading, error, isMutating, mutationError, clearMutationError, toggleFlag } =
    usePlatformFlags();
  const [togglingKey, setTogglingKey] = useState<string | null>(null);

  const categories = Array.from(new Set(flags.map((f) => f.category))).sort();

  async function handleToggle(flag: ApiFeatureFlag) {
    setTogglingKey(flag.key);
    await toggleFlag(flag.key, !flag.enabled);
    setTogglingKey(null);
  }

  // ── Loading skeleton ────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-8 pb-10 animate-pulse">
        {[1, 2].map((g) => (
          <div key={g} className="space-y-3">
            <div className="h-3 bg-slate-100 rounded w-24" />
            <div className="border border-border rounded-lg overflow-hidden bg-background divide-y divide-border">
              {[1, 2, 3].map((r) => (
                <div key={r} className="px-5 py-4 flex justify-between items-center">
                  <div className="space-y-2">
                    <div className="h-4 bg-slate-100 rounded w-40" />
                    <div className="h-3 bg-slate-100 rounded w-64" />
                  </div>
                  <div className="h-6 bg-slate-100 rounded w-20" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ── Error state ─────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-8 text-center">
        <p className="text-sm font-medium text-red-700">Failed to load feature flags</p>
        <p className="text-xs text-red-500 mt-1">{error}</p>
      </div>
    );
  }

  // ── Empty state ─────────────────────────────────────────────────────────────
  if (flags.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-background p-12 text-center">
        <p className="text-sm text-muted-foreground">No feature flags configured.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10">
      {mutationError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 flex justify-between items-center">
          <p className="text-sm text-red-700">{mutationError}</p>
          <button onClick={clearMutationError} className="text-red-400 hover:text-red-600 text-xs">
            Dismiss
          </button>
        </div>
      )}

      {categories.map((category) => {
        const categoryFlags = flags.filter((f) => f.category === category);
        return (
          <div key={category} className="space-y-3">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-1">
              {category}
            </h3>
            <div className="border border-border rounded-lg overflow-hidden bg-background divide-y divide-border">
              {categoryFlags.map((flag) => (
                <ConfigurationRow
                  key={flag.id}
                  title={flag.name}
                  description={flag.description ?? ""}
                  infoText={getInfoText(flag.key)}
                  onClick={() => onSelect(flag)}
                  statusNode={
                    <StatusBadge
                      status={flag.enabled ? "active" : "neutral"}
                      label={flag.enabled ? "Enabled" : "Disabled"}
                      dot
                    />
                  }
                  metadataNode={
                    <div className="flex items-center gap-4">
                      {flag.rollout_strategy !== "GLOBAL" && (
                        <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded text-[11px] font-medium border border-purple-200/50">
                          {formatRollout(flag)}
                        </span>
                      )}
                      <RiskBadge level={flag.risk_level} />
                      <button
                        disabled={togglingKey === flag.key || isMutating}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggle(flag);
                        }}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1 disabled:opacity-50 ${
                          flag.enabled ? "bg-slate-800" : "bg-slate-200"
                        }`}
                        aria-label={flag.enabled ? `Disable ${flag.name}` : `Enable ${flag.name}`}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform ${
                            flag.enabled ? "translate-x-4" : "translate-x-0.5"
                          }`}
                        />
                      </button>
                    </div>
                  }
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
