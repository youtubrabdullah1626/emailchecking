"use client";

import { usePlatformFlags } from "../../hooks/usePlatformFlags";
import { usePlatformConfigs } from "../../hooks/usePlatformConfigs";
import { usePlatformProviders } from "../../hooks/usePlatformProviders";

export function OverviewTab() {
  const { flags, isLoading: flagsLoading } = usePlatformFlags();
  const { configs, isLoading: configsLoading } = usePlatformConfigs();
  const { providers, isLoading: providersLoading } = usePlatformProviders();

  const isLoading = flagsLoading || configsLoading || providersLoading;
  const activeFlags = flags.filter((f) => f.enabled).length;
  const disabledFlags = flags.filter((f) => !f.enabled).length;
  const emailProvider = providers.find((p) => p.key === "EMAIL_PROVIDER");

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Active Feature Flags"
          value={isLoading ? "—" : activeFlags.toString()}
          loading={isLoading}
        />
        <MetricCard
          title="Disabled Features"
          value={isLoading ? "—" : disabledFlags.toString()}
          loading={isLoading}
        />
        <MetricCard
          title="Platform Limits"
          value={isLoading ? "—" : configs.length.toString()}
          loading={isLoading}
        />
        <MetricCard
          title="Email Provider"
          value={isLoading ? "—" : (emailProvider?.active_provider ?? "—")}
          loading={isLoading}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="border border-border rounded-lg p-6 bg-background space-y-4">
          <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider">
            Environment Status
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-foreground font-medium">Current Environment</span>
              <span className="text-sm font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                Production
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-foreground font-medium">Feature Flags</span>
              <span className="text-sm font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                {isLoading ? "—" : `${activeFlags} / ${flags.length} active`}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-foreground font-medium">Provider Integrations</span>
              <span className="text-sm font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                {isLoading ? "—" : `${providers.length} configured`}
              </span>
            </div>
          </div>
        </div>

        <div className="border border-border rounded-lg p-6 bg-background space-y-4">
          <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider">
            Active Providers
          </h3>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex justify-between items-center animate-pulse">
                  <div className="h-4 bg-slate-100 rounded w-28" />
                  <div className="h-4 bg-slate-100 rounded w-20" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {providers.map((p) => (
                <div key={p.key} className="flex justify-between items-center">
                  <span className="text-sm text-foreground font-medium">{p.name}</span>
                  <span className="text-sm font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs">
                    {p.active_provider}
                  </span>
                </div>
              ))}
              {providers.length === 0 && (
                <p className="text-sm text-muted-foreground">No providers configured.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  loading,
}: {
  title: string;
  value: string;
  loading?: boolean;
}) {
  return (
    <div className="border border-border rounded-lg p-5 bg-background flex flex-col justify-between h-28">
      <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{title}</span>
      {loading ? (
        <div className="h-9 bg-slate-100 rounded animate-pulse w-16 mt-2" />
      ) : (
        <span className="text-3xl font-semibold text-slate-900 tracking-tight">{value}</span>
      )}
    </div>
  );
}
