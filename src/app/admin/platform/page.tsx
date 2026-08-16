"use client";

import React, { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Sliders, Info, Sparkles, Shield, Cpu, RefreshCw, Layers } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { OverviewTab } from "./components/tabs/OverviewTab";
import { FeatureFlagsTab } from "./components/tabs/FeatureFlagsTab";
import { PlatformLimitsTab } from "./components/tabs/PlatformLimitsTab";
import { ProviderRoutingTab } from "./components/tabs/ProviderRoutingTab";
import { RolloutsTab } from "./components/tabs/RolloutsTab";
import { VersionHistoryTab } from "./components/tabs/VersionHistoryTab";
import { ConfigurationDrawer } from "./components/shared/ConfigurationDrawer";
import { ApiFeatureFlag, ApiPlatformConfig, ApiProviderConfig } from "./hooks/types";

type SelectedItem = ApiFeatureFlag | ApiPlatformConfig | ApiProviderConfig | null;

function PlatformConfigurationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const activeTab = searchParams?.get("tab") ?? "overview";
  const drawerItemKey = searchParams?.get("drawer_item") ?? null;
  const drawerDomain = searchParams?.get("drawer_domain") ?? null;

  function setTab(tab: string) {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("tab", tab);
    router.push(`?${params.toString()}`);
  }

  function setDrawerItem(item: SelectedItem, domain?: string) {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (item && domain) {
      params.set("drawer_item", item.key);
      params.set("drawer_domain", domain);
    } else {
      params.delete("drawer_item");
      params.delete("drawer_domain");
    }
    router.push(`?${params.toString()}`);
  }

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Signature Silaer Dynamic Header Banner */}
      <div className="bg-gradient-to-r from-primary/15 via-primary/5 to-card border border-primary/20 rounded-2xl p-5 md:p-6 shadow-xs relative overflow-hidden transition-colors duration-300">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start sm:items-center gap-4">
            <div className="h-11 w-11 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0 border border-primary/25 shadow-xs">
              <Sliders className="h-5 w-5" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                  Platform Configuration & Theme Controller
                </h1>
                <TooltipProvider>
                  <Tooltip delayDuration={200}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="flex items-center justify-center h-5 w-5 rounded-full bg-primary/15 text-primary hover:bg-primary/25 transition-colors cursor-help"
                      >
                        <Info className="h-3 w-3" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" align="center" className="max-w-xs p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl rounded-xl z-50 text-xs">
                      <p className="font-semibold text-slate-900 dark:text-white mb-1">
                        Global Operational Governance
                      </p>
                      <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                        Control global rate limits, BANNER_THEME color tinting, feature toggles, and Google API routing across all user workspaces.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                Manage system limits, live banner themes, feature toggles, and provider routing safely.
              </p>
            </div>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setTab} className="w-full space-y-6">
        <TabsList className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1 rounded-2xl shadow-xs flex flex-wrap h-auto gap-1">
          {[
            { value: "overview", label: "Overview", icon: Layers },
            { value: "feature-flags", label: "Feature Flags", icon: Sparkles },
            { value: "platform-limits", label: "Platform Limits & Theme", icon: Sliders },
            { value: "provider-routing", label: "Provider Routing", icon: Cpu },
            { value: "rollouts", label: "Rollouts", icon: Shield },
            { value: "version-history", label: "Version History", icon: RefreshCw },
          ].map(({ value, label, icon: Icon }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold data-[state=active]:bg-primary/15 data-[state=active]:text-primary border border-transparent data-[state=active]:border-primary/25 flex items-center gap-1.5 transition-all"
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="mt-0 focus-visible:outline-none">
          <OverviewTab />
        </TabsContent>
        <TabsContent value="feature-flags" className="mt-0 focus-visible:outline-none">
          <FeatureFlagsTab onSelect={(item) => setDrawerItem(item, "flag")} />
        </TabsContent>
        <TabsContent value="platform-limits" className="mt-0 focus-visible:outline-none">
          <PlatformLimitsTab onSelect={(item) => setDrawerItem(item, "config")} />
        </TabsContent>
        <TabsContent value="provider-routing" className="mt-0 focus-visible:outline-none">
          <ProviderRoutingTab onSelect={(item) => setDrawerItem(item, "provider")} />
        </TabsContent>
        <TabsContent value="rollouts" className="mt-0 focus-visible:outline-none">
          <RolloutsTab onSelect={(item) => setDrawerItem(item, "flag")} />
        </TabsContent>
        <TabsContent value="version-history" className="mt-0 focus-visible:outline-none">
          <VersionHistoryTab />
        </TabsContent>
      </Tabs>

      <ConfigurationDrawer 
        itemKey={drawerItemKey} 
        domain={drawerDomain} 
        onClose={() => setDrawerItem(null)} 
      />
    </div>
  );
}

export default function PlatformConfigurationPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-slate-400">Loading Configuration...</div>}>
      <PlatformConfigurationContent />
    </Suspense>
  );
}
