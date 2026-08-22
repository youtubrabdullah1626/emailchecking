"use client";

import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { RiskBadge } from "./RiskBadge";
import { StatusBadge } from "@/components/ui/status-badge";
import { useFlagHistory, usePlatformFlags } from "../../hooks/usePlatformFlags";
import { useConfigHistory, usePlatformConfigs } from "../../hooks/usePlatformConfigs";
import { useProviderHistory, usePlatformProviders } from "../../hooks/usePlatformProviders";
import {
  ApiFeatureFlag,
  ApiPlatformConfig,
  ApiProviderConfig,
  formatAllowedRange,
  formatRollout,
} from "../../hooks/types";
import { Sparkles } from "lucide-react";
import { useSWRConfig } from "swr";
import { toast } from "sonner";

function getAIRecommendation(key: string): string | null {
  switch (key) {
    case "MAX_DAILY_EMAILS":
      return "💡 We recommend setting this between 100 and 300. Sending too many emails in a single day (like 500+) looks like spam and can cause your email account to get permanently blocked by Gmail.";
    case "HOURLY_EMAIL_LIMIT":
      return "💡 We recommend a limit of 25 to 50 emails per hour. This mimics how a real human sends emails. Trying to send 100+ emails in one hour is a massive red flag for spam filters.";
    case "MAX_ACTIVE_SEQUENCES":
      return "💡 We recommend keeping this limit between 3 and 5. Having too many active campaigns running at the same time can cause you to lose track of replies and miss out on potential leads.";
    case "SCHEDULER_BATCH_SIZE":
      return "💡 We recommend keeping the batch size at 50. Processing more than this at once can overload the system and cause your emails to fail or get delayed.";
    case "MAX_IMPORT_ROWS":
      return "💡 This controls how many email contacts a user can add to a campaign at one time. We recommend keeping this under 25,000. If a user tries to add 100,000 contacts all at once, their computer might freeze while trying to load them.";
    case "BANNER_THEME":
      return "💡 We recommend using standard colors (like GREEN or BLUE) for normal days. Save RED or ORANGE for critical announcements or special global events (like sales) to catch your team's attention.";
    default:
      return null;
  }
}

type ConfigItem = ApiFeatureFlag | ApiPlatformConfig | ApiProviderConfig;

function isFlag(item: ConfigItem | null): item is ApiFeatureFlag {
  return !!item && "enabled" in item && "rollout_strategy" in item;
}
function isConfig(item: ConfigItem | null): item is ApiPlatformConfig {
  return !!item && "data_type" in item;
}
function isProvider(item: ConfigItem | null): item is ApiProviderConfig {
  return !!item && "active_provider" in item && !("data_type" in item);
}

interface ConfigurationDrawerProps {
  itemKey: string | null;
  domain: string | null;
  onClose: () => void;
}

export function ConfigurationDrawer({ itemKey, domain, onClose }: ConfigurationDrawerProps) {
  const { mutate: globalMutate } = useSWRConfig();
  const { flags, toggleFlag, isMutating: flagMutating, mutationError: flagError } = usePlatformFlags();
  const { configs, updateConfig, validateValue, isMutating: configMutating, mutationError: configError } = usePlatformConfigs();
  const { providers, updateProvider, isMutating: providerMutating, mutationError: providerError } = usePlatformProviders();

  // Dynamically resolve the item from SWR cache
  const item: ConfigItem | null =
    domain === "flag"
      ? flags.find((f) => f.key === itemKey) ?? null
      : domain === "config"
      ? configs.find((c) => c.key === itemKey) ?? null
      : domain === "provider"
      ? providers.find((p) => p.key === itemKey) ?? null
      : null;

  const isMutating = flagMutating || configMutating || providerMutating;

  // Editor state
  const [editValue, setEditValue] = useState<string>("");
  const [editReason, setEditReason] = useState<string>("");
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (!item) return;
    setSaveError(null);
    setSaveSuccess(false);
    setValidationErrors([]);
    setEditReason("");
    if (isConfig(item)) setEditValue(String(item.value));
    if (isProvider(item)) setEditValue(item.active_provider);
    if (isFlag(item)) setEditValue(item.enabled ? "true" : "false");
  }, [item]);

  // History hooks — only active when item is open
  const { history: flagHistory, isLoading: flagHistoryLoading } = useFlagHistory(
    item && isFlag(item) ? item.key : null
  );
  const { history: configHistory, isLoading: configHistoryLoading } = useConfigHistory(
    item && isConfig(item) ? item.key : null
  );
  const { history: providerHistory, isLoading: providerHistoryLoading } = useProviderHistory(
    item && isProvider(item) ? item.key : null
  );

  const historyLoading = flagHistoryLoading || configHistoryLoading || providerHistoryLoading;
  const history = item
    ? isFlag(item)
      ? flagHistory
      : isConfig(item)
      ? configHistory
      : providerHistory
    : [];

  if (!item) return null;

  const riskLevel = "risk_level" in item ? item.risk_level : null;
  const category = "category" in item ? item.category : null;
  const itemDescription = item.description ?? "";

  async function handleSave() {
    setSaveError(null);
    setSaveSuccess(false);
    setValidationErrors([]);

    if (isConfig(item)) {
      // Parse value by type
      let parsedValue: unknown = editValue;
      if (item.data_type === "NUMBER") parsedValue = Number(editValue);
      if (item.data_type === "BOOLEAN") parsedValue = editValue === "true";

      // Validate first
      const result = await validateValue(item.key, parsedValue);
      if (!result.valid) {
        setValidationErrors(result.errors);
        return;
      }

      const ok = await updateConfig(item.key, parsedValue, editReason || undefined);
      if (ok) {
        setSaveSuccess(true);
        if (item.key === "BANNER_THEME") {
          document.body.setAttribute("data-theme", String(parsedValue));
        }
        globalMutate((k: any) => typeof k === "string" && (k.startsWith("/api/dashboard") || k.startsWith("/api/admin/platform")));
        toast.success("Platform configuration updated live across all dashboards!");
      } else {
        setSaveError(configError || "Save failed. Please check validation rules.");
      }
    }

    if (isProvider(item)) {
      const ok = await updateProvider(item.key, editValue, editReason || undefined);
      if (ok) {
        setSaveSuccess(true);
        globalMutate((k: any) => typeof k === "string" && (k.startsWith("/api/dashboard") || k.startsWith("/api/admin/platform")));
        toast.success("Provider updated live!");
      } else {
        setSaveError(providerError || "Save failed. Please try again.");
      }
    }

    if (isFlag(item)) {
      const ok = await toggleFlag(item.key, editValue === "true", editReason || undefined);
      if (ok) {
        setSaveSuccess(true);
        globalMutate((k: any) => typeof k === "string" && (k.startsWith("/api/dashboard") || k.startsWith("/api/admin/platform")));
        toast.success("Feature flag toggled live!");
      } else {
        setSaveError(flagError || "Failed to toggle flag.");
      }
    }
  }

  return (
    <Sheet open={!!item} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-[600px] sm:max-w-xl p-0 flex flex-col gap-0 border-l border-border"
      >
        {/* Header */}
        <div className="p-6 border-b border-border bg-slate-50/50">
          <SheetHeader className="text-left space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <SheetTitle className="text-xl font-semibold tracking-tight">
                  {item.name}
                </SheetTitle>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {category && (
                    <span className="text-xs font-medium bg-muted px-2 py-0.5 rounded text-muted-foreground uppercase tracking-wider">
                      {category}
                    </span>
                  )}
                  {isFlag(item) && (
                    <StatusBadge
                      status={item.enabled ? "active" : "neutral"}
                      label={item.enabled ? "Enabled" : "Disabled"}
                      dot
                    />
                  )}
                  {riskLevel && <RiskBadge level={riskLevel} />}
                </div>
              </div>
            </div>
            <SheetDescription className="text-sm text-slate-600 leading-relaxed">
              {itemDescription}
            </SheetDescription>
          </SheetHeader>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-6">
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent mb-6 space-x-6">
                {["overview", "configuration", "dependencies", "history"].map((tab) => (
                  <TabsTrigger
                    key={tab}
                    value={tab}
                    className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-foreground rounded-none px-0 pb-3 pt-2 capitalize"
                  >
                    {tab}
                  </TabsTrigger>
                ))}
              </TabsList>

              {/* ── Overview Tab ─────────────────────────────────────────────── */}
              <TabsContent value="overview" className="space-y-6 mt-0 focus-visible:outline-none">
                <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                  <div className="space-y-1.5">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Internal Key
                    </span>
                    <p className="text-sm font-mono text-slate-700 bg-slate-100 px-2 py-1 rounded w-fit">
                      {item.key}
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Last Updated
                    </span>
                    <p className="text-sm text-foreground">
                      {new Date(item.updated_at).toLocaleDateString()}{" "}
                      {new Date(item.updated_at).toLocaleTimeString()}
                    </p>
                  </div>

                  {isFlag(item) && (
                    <>
                      <div className="space-y-1.5">
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Rollout Strategy
                        </span>
                        <p className="text-sm text-foreground">{formatRollout(item)}</p>
                      </div>
                      <div className="space-y-1.5">
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Dependencies
                        </span>
                        <p className="text-sm text-foreground">
                          {item.depends_on.length > 0 ? item.depends_on.join(", ") : "None"}
                        </p>
                      </div>
                    </>
                  )}

                  {isConfig(item) && (
                    <>
                      <div className="space-y-1.5">
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Current Value
                        </span>
                        <p className="text-sm font-mono text-slate-700 bg-slate-100 px-2 py-1 rounded w-fit">
                          {String(item.value)}
                        </p>
                      </div>
                      <div className="space-y-1.5">
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Allowed Range
                        </span>
                        <p className="text-sm text-foreground">{formatAllowedRange(item) || "—"}</p>
                      </div>
                    </>
                  )}

                  {isProvider(item) && (
                    <>
                      <div className="space-y-1.5">
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Active Provider
                        </span>
                        <p className="text-sm font-medium text-foreground">
                          {item.active_provider}
                        </p>
                      </div>
                      <div className="space-y-1.5">
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Available Options
                        </span>
                        <p className="text-sm text-foreground">
                          {item.allowed_values.join(", ")}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </TabsContent>

              {/* ── Configuration Tab ─────────────────────────────────────────── */}
              <TabsContent value="configuration" className="mt-0 focus-visible:outline-none">
                <div className="space-y-5">
                  {saveSuccess && (
                    <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                      ✓ Saved successfully. Cache cleared and UI updated.
                    </div>
                  )}
                  {saveError && (
                    <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {saveError}
                    </div>
                  )}
                  {validationErrors.length > 0 && (
                    <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 space-y-1">
                      {validationErrors.map((e, i) => (
                        <p key={i} className="text-sm text-red-700">
                          {e}
                        </p>
                      ))}
                    </div>
                  )}

                  {/* Value editor */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {isFlag(item) ? "State" : isProvider(item) ? "Active Provider" : "Value"}
                    </label>

                    {getAIRecommendation(item.key) && (
                      <div className="flex items-start gap-2.5 rounded-md border border-indigo-200/60 bg-indigo-50/50 px-4 py-3 mb-3">
                        <Sparkles className="h-4 w-4 text-indigo-500 mt-0.5 shrink-0" />
                        <p className="text-[13px] leading-relaxed text-indigo-900/90 font-medium">
                          {getAIRecommendation(item.key)}
                        </p>
                      </div>
                    )}

                    {isFlag(item) && (
                      <select
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-slate-400"
                      >
                        <option value="true">Enabled</option>
                        <option value="false">Disabled</option>
                      </select>
                    )}

                    {isConfig(item) && item.data_type === "NUMBER" && (
                      <input
                        type="number"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="w-full border border-border rounded-md px-3 py-2 text-sm font-mono bg-background focus:outline-none focus:ring-2 focus:ring-slate-400"
                        min={item.validation_rules?.min}
                        max={item.validation_rules?.max}
                      />
                    )}

                    {isConfig(item) && item.data_type === "STRING" && (
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-slate-400"
                      />
                    )}

                    {isConfig(item) && item.data_type === "BOOLEAN" && (
                      <select
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-slate-400"
                      >
                        <option value="true">True</option>
                        <option value="false">False</option>
                      </select>
                    )}

                    {isConfig(item) && item.data_type === "ENUM" && (
                      <select
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-slate-400"
                      >
                        {(item.validation_rules?.options ?? []).map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    )}

                    {isProvider(item) && (
                      <select
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-slate-400"
                      >
                        {item.allowed_values.map((v) => (
                          <option key={v} value={v}>
                            {v}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Reason field */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Reason for Change{" "}
                      <span className="text-slate-400 normal-case tracking-normal">(optional)</span>
                    </label>
                    <textarea
                      value={editReason}
                      onChange={(e) => setEditReason(e.target.value)}
                      rows={2}
                      placeholder="Briefly describe why you are making this change…"
                      className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background resize-none focus:outline-none focus:ring-2 focus:ring-slate-400 placeholder:text-slate-400"
                    />
                  </div>

                  <Button
                    onClick={handleSave}
                    disabled={isMutating}
                    className="w-full"
                    size="sm"
                  >
                    {isMutating ? "Saving…" : "Save Changes"}
                  </Button>
                </div>
              </TabsContent>

              {/* ── Dependencies Tab ──────────────────────────────────────────── */}
              <TabsContent value="dependencies" className="mt-0 focus-visible:outline-none">
                {isFlag(item) && item.depends_on.length > 0 ? (
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground">
                      This flag requires the following flags to be enabled first.
                    </p>
                    <div className="space-y-2">
                      {item.depends_on.map((dep) => (
                        <div
                          key={dep}
                          className="border border-border rounded-md px-4 py-3 bg-background flex items-center gap-3"
                        >
                          <span className="h-2 w-2 rounded-full bg-slate-300" />
                          <span className="text-sm font-mono text-slate-700">{dep}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-md border border-border bg-slate-50 p-8 text-center flex flex-col items-center justify-center text-muted-foreground h-40">
                    <span className="text-sm">No dependencies</span>
                    <span className="text-xs mt-2">
                      {isFlag(item)
                        ? "This flag operates independently."
                        : "Dependencies only apply to feature flags."}
                    </span>
                  </div>
                )}
              </TabsContent>

              {/* ── History Tab ───────────────────────────────────────────────── */}
              <TabsContent value="history" className="mt-0 focus-visible:outline-none">
                {historyLoading ? (
                  <div className="space-y-4 animate-pulse">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="space-y-2">
                        <div className="h-4 bg-slate-100 rounded w-32" />
                        <div className="h-3 bg-slate-100 rounded w-64" />
                      </div>
                    ))}
                  </div>
                ) : history.length === 0 ? (
                  <div className="rounded-md border border-border bg-slate-50 p-8 text-center flex flex-col items-center justify-center text-muted-foreground h-40">
                    <span className="text-sm">No history yet</span>
                    <span className="text-xs mt-2">Changes will appear here after the first update.</span>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {(history as any[]).map((entry, idx) => {
                      const changedAt =
                        "changed_at" in entry ? entry.changed_at : entry.changedAt;
                      const changedBy =
                        "changed_by" in entry ? entry.changed_by : entry.changedBy;
                      const reason = entry.reason;
                      const isRollback =
                        "is_rollback" in entry ? entry.is_rollback : entry.isRollback;

                      return (
                        <div
                          key={entry.id}
                          className="border border-border rounded-md px-4 py-3 bg-background space-y-1.5"
                        >
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              {isRollback && (
                                <span className="text-[10px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200/60">
                                  Rollback
                                </span>
                              )}
                              <span className="text-xs text-slate-500">
                                {new Date(changedAt).toLocaleString(undefined, {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                              <span className="text-xs text-slate-400">•</span>
                              <span className="text-xs text-slate-600 font-medium">{changedBy}</span>
                            </div>
                          </div>
                          {reason && (
                            <p className="text-xs text-slate-600 leading-relaxed">{reason}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
