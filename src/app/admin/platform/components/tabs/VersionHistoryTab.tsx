"use client";

import { useState } from "react";
import { useFlagHistory } from "../../hooks/usePlatformFlags";
import { useConfigHistory } from "../../hooks/usePlatformConfigs";
import { useProviderHistory } from "../../hooks/usePlatformProviders";
import { usePlatformFlags } from "../../hooks/usePlatformFlags";
import { usePlatformConfigs } from "../../hooks/usePlatformConfigs";
import { usePlatformProviders } from "../../hooks/usePlatformProviders";
import { Button } from "@/components/ui/button";

// Unified history entry for the timeline
interface TimelineEntry {
  id: string;
  domain: "flag" | "config" | "provider";
  subject: string;
  changedBy: string;
  changedAt: string;
  reason: string | null;
  isRollback: boolean;
  from: string;
  to: string;
}

export function VersionHistoryTab() {
  const { flags, revalidate: revalidateFlags } = usePlatformFlags();
  const { configs, revalidate: revalidateConfigs } = usePlatformConfigs();
  const { providers, revalidate: revalidateProviders } = usePlatformProviders();

  // Load history for all current keys in parallel
  const firstFlag = flags[0]?.key ?? null;
  const firstConfig = configs[0]?.key ?? null;
  const firstProvider = providers[0]?.key ?? null;

  const { history: flagHistory, isLoading: flagLoading } = useFlagHistory(firstFlag);
  const { history: configHistory, isLoading: configLoading } = useConfigHistory(firstConfig);
  const { history: providerHistory, isLoading: providerLoading } = useProviderHistory(firstProvider);

  const [rollingBack, setRollingBack] = useState<string | null>(null);
  const [rollbackError, setRollbackError] = useState<string | null>(null);

  const isLoading = flagLoading || configLoading || providerLoading;

  // Build unified timeline
  const timeline: TimelineEntry[] = [
    ...(flagHistory || []).map((h) => ({
      id: h.id,
      domain: "flag" as const,
      subject: flags.find((f) => f.id === h.flag_id)?.name ?? "Feature Flag",
      changedBy: h.changed_by,
      changedAt: h.changed_at,
      reason: h.reason,
      isRollback: h.is_rollback,
      from: h.old_value && typeof h.old_value === "object" && "enabled" in h.old_value ? (h.old_value.enabled ? "Enabled" : "Disabled") : String(h.old_value ?? "—"),
      to: h.new_value && typeof h.new_value === "object" && "enabled" in h.new_value ? (h.new_value.enabled ? "Enabled" : "Disabled") : String(h.new_value ?? "—"),
    })),
    ...(configHistory || []).map((h) => ({
      id: h.id,
      domain: "config" as const,
      subject: configs.find((c) => c.id === h.config_id)?.name ?? "Platform Config",
      changedBy: h.changed_by,
      changedAt: h.changed_at,
      reason: h.reason,
      isRollback: h.is_rollback,
      from: String(h.old_value ?? "—"),
      to: String(h.new_value ?? "—"),
    })),
    ...(providerHistory || []).map((h) => ({
      id: h.id,
      domain: "provider" as const,
      subject: providers.find((p) => p.id === h.provider_id)?.name ?? "Provider",
      changedBy: h.changed_by,
      changedAt: h.changed_at,
      reason: h.reason,
      isRollback: h.is_rollback,
      from: (h.old_value && typeof h.old_value === "object" && "active_provider" in h.old_value) ? (h.old_value as any).active_provider : String(h.old_value ?? "—"),
      to: (h.new_value && typeof h.new_value === "object" && "active_provider" in h.new_value) ? (h.new_value as any).active_provider : String(h.new_value ?? "—"),
    })),
  ].sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime());

  async function handleRollback(entry: TimelineEntry) {
    if (!confirm(`Rollback "${entry.subject}" from "${entry.to}" back to "${entry.from}"?`)) return;
    setRollingBack(entry.id);
    setRollbackError(null);
    try {
      const res = await fetch("/api/admin/platform/rollback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: entry.domain, historyId: entry.id }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Rollback failed");
      }
      // Revalidate only affected caches
      if (entry.domain === "flag") await revalidateFlags();
      if (entry.domain === "config") await revalidateConfigs();
      if (entry.domain === "provider") await revalidateProviders();
    } catch (err: any) {
      setRollbackError(err.message);
    } finally {
      setRollingBack(null);
    }
  }

  if (isLoading && timeline.length === 0) {
    return (
      <div className="space-y-6 max-w-4xl pb-10 animate-pulse">
        <div className="border border-border rounded-lg bg-background p-6">
          <div className="relative pl-6 border-l border-slate-200 ml-4 space-y-10">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 bg-slate-100 rounded w-48" />
                <div className="h-3 bg-slate-100 rounded w-80" />
                <div className="h-3 bg-slate-100 rounded w-32" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl pb-10">
      {rollbackError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 flex justify-between items-center">
          <p className="text-sm text-red-700">{rollbackError}</p>
          <button
            onClick={() => setRollbackError(null)}
            className="text-red-400 hover:text-red-600 text-xs"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="border border-border rounded-lg bg-background p-6">
        {timeline.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-muted-foreground">No configuration changes recorded yet.</p>
            <p className="text-xs text-muted-foreground mt-1">
              Changes will appear here after the first update.
            </p>
          </div>
        ) : (
          <div className="relative pl-6 border-l border-slate-200 ml-4 space-y-10">
            {timeline.map((entry, idx) => (
              <div key={entry.id} className="relative">
                <div
                  className={`absolute -left-[31px] top-1 h-3 w-3 rounded-full ring-4 ring-background ${
                    entry.isRollback ? "bg-amber-400" : "bg-slate-200"
                  }`}
                />

                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-[14px] font-semibold text-foreground">
                        {entry.subject}
                      </span>
                      <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded uppercase tracking-wide border border-slate-200/60">
                        {entry.domain}
                      </span>
                      {entry.isRollback && (
                        <span className="text-[11px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded border border-amber-200/60">
                          Rollback
                        </span>
                      )}
                      <span className="text-[12px] text-slate-500">•</span>
                      <span className="text-[12px] text-slate-500">{entry.changedBy}</span>
                      <span className="text-[12px] text-slate-500">•</span>
                      <span className="text-[12px] text-slate-500">
                        {new Date(entry.changedAt).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[12px]">
                      <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">
                        {entry.from}
                      </span>
                      <span className="text-slate-400">→</span>
                      <span className="font-mono bg-slate-800 text-white px-1.5 py-0.5 rounded">
                        {entry.to}
                      </span>
                    </div>

                    {entry.reason && (
                      <p className="text-[13px] text-slate-700 leading-relaxed max-w-xl">
                        {entry.reason}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2 shrink-0">
                    {idx > 0 && !entry.isRollback && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={rollingBack === entry.id}
                        onClick={() => handleRollback(entry)}
                        className="h-7 text-[11px] px-3 font-medium text-amber-700 hover:text-amber-800 border-amber-200 bg-amber-50 hover:bg-amber-100"
                      >
                        {rollingBack === entry.id ? "Restoring…" : "Restore"}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
