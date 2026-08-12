"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OverviewTab } from "./components/tabs/OverviewTab";
import { FeatureFlagsTab } from "./components/tabs/FeatureFlagsTab";
import { PlatformLimitsTab } from "./components/tabs/PlatformLimitsTab";
import { ProviderRoutingTab } from "./components/tabs/ProviderRoutingTab";
import { RolloutsTab } from "./components/tabs/RolloutsTab";
import { VersionHistoryTab } from "./components/tabs/VersionHistoryTab";
import { ConfigurationDrawer } from "./components/shared/ConfigurationDrawer";
import { ApiFeatureFlag, ApiPlatformConfig, ApiProviderConfig } from "./hooks/types";

type SelectedItem = ApiFeatureFlag | ApiPlatformConfig | ApiProviderConfig | null;

export default function PlatformConfigurationPage() {
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
    <div className="flex flex-col min-h-screen bg-slate-50/30 text-foreground pb-20">
      <div className="flex-1 p-8 pt-6 max-w-[1600px] w-full mx-auto space-y-8">
        <PageHeader
          title="Platform Configuration"
          description="Manage enterprise feature flags, limits, and provider routing safely."
        />

        <Tabs value={activeTab} onValueChange={setTab} className="w-full">
          <TabsList className="w-full justify-start border-b border-border rounded-none h-auto p-0 bg-transparent mb-8 space-x-6 overflow-x-auto overflow-y-hidden no-scrollbar">
            {[
              { value: "overview", label: "Overview" },
              { value: "feature-flags", label: "Feature Flags" },
              { value: "platform-limits", label: "Platform Limits" },
              { value: "provider-routing", label: "Provider Routing" },
              { value: "rollouts", label: "Rollouts" },
              { value: "version-history", label: "Version History" },
            ].map(({ value, label }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-foreground rounded-none px-0 pb-3 pt-2 font-medium"
              >
                {label}
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
      </div>

      <ConfigurationDrawer 
        itemKey={drawerItemKey} 
        domain={drawerDomain} 
        onClose={() => setDrawerItem(null)} 
      />
    </div>
  );
}
