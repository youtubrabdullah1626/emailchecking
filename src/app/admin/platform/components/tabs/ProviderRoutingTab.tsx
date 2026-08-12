"use client";

import { usePlatformProviders } from "../../hooks/usePlatformProviders";
import { ApiProviderConfig } from "../../hooks/types";

interface ProviderRoutingTabProps {
  onSelect: (item: ApiProviderConfig) => void;
}

export function ProviderRoutingTab({ onSelect }: ProviderRoutingTabProps) {
  const { providers, isLoading, error } = usePlatformProviders();

  if (isLoading) {
    return (
      <div className="space-y-8 pb-10 max-w-4xl animate-pulse">
        <div className="space-y-3">
          <div className="h-3 bg-slate-100 rounded w-36" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="border border-border rounded-lg p-5 bg-background space-y-3">
                <div className="h-4 bg-slate-100 rounded w-32" />
                <div className="h-3 bg-slate-100 rounded w-full" />
                <div className="h-3 bg-slate-100 rounded w-3/4" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-8 text-center">
        <p className="text-sm font-medium text-red-700">Failed to load provider routing</p>
        <p className="text-xs text-red-500 mt-1">{error}</p>
      </div>
    );
  }

  if (providers.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-background p-12 text-center">
        <p className="text-sm text-muted-foreground">No provider integrations configured.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10 max-w-4xl">
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-1">
          Active Integrations
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {providers.map((provider) => (
            <div
              key={provider.id}
              onClick={() => onSelect(provider)}
              className="border border-border rounded-lg p-5 bg-background hover:bg-muted/40 transition-colors cursor-pointer group"
            >
              <div className="flex justify-between items-start mb-3">
                <span className="text-[14px] font-medium text-foreground">{provider.name}</span>
                <span className="bg-blue-50 text-blue-700 border border-blue-200/50 px-2 py-0.5 rounded text-[11px] font-medium">
                  {provider.active_provider}
                </span>
              </div>
              <p className="text-[13px] text-muted-foreground mb-4 h-10 line-clamp-2">
                {provider.description}
              </p>
              <div className="pt-3 border-t border-border flex justify-between items-center">
                <span className="text-[11px] text-slate-400 uppercase tracking-wider">
                  {provider.allowed_values.length} Options Available
                </span>
                <span className="text-[12px] font-medium text-slate-500 group-hover:text-slate-800 transition-colors">
                  Change Provider &rarr;
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
