"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { apiClient, ApiError } from "@/lib/api-client";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

// UI Components
import { PageHeader } from "@/components/ui/page-header";
import { AnimatedPage } from "@/components/ui/animated";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mail, Clock, Cpu, Bell, Key, Zap, User, Globe, Lock, ShieldCheck, CheckCircle2, AlertCircle, Plus, Sparkles, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TIMEZONE_GROUPS, getTimezoneLabel } from "@/lib/timezones";

// Existing Types
import type { ConnectedAccountProps } from "@/components/ConnectedAccountCard";
import ConnectedAccountCard from "@/components/ConnectedAccountCard";

const settingsSchema = z.object({
  schedulerEnabled: z.boolean(),
  schedulerCron: z.string(),
  geminiEnabled: z.boolean(),
  geminiModel: z.string().optional(),
  notificationsEnabled: z.boolean(),
  notifyOnReply: z.boolean(),
  notifyOnFailure: z.boolean(),
  retryFailedEmails: z.boolean().default(true),
  maxRetries: z.coerce.number().default(3),
  autoCloserEnabled: z.boolean().default(true),
  autoCloserRebuttalStyle: z.string().default("AGGRESSIVE"),
  autoCloserAutoDraft: z.boolean().default(true),
});

export default function SettingsPage() {
  const [accounts, setAccounts] = useState<ConnectedAccountProps[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [displayName, setDisplayName] = useState("Team");
  const [timezone, setTimezone] = useState("UTC");
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [cooldown, setCooldown] = useState<{
    canChange: boolean;
    remainingDays: number;
    nextAllowedDate: string | null;
  }>({ canChange: true, remainingDays: 0, nextAllowedDate: null });

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const form = useForm<z.infer<typeof settingsSchema>>({
    resolver: zodResolver(settingsSchema) as any,
    defaultValues: {
      schedulerEnabled: true,
      schedulerCron: "*/5 * * * *",
      geminiEnabled: true,
      geminiModel: "gemini-1.5-pro-latest",
      notificationsEnabled: true,
      notifyOnReply: true,
      notifyOnFailure: true,
      retryFailedEmails: true,
      maxRetries: 3,
      autoCloserEnabled: true,
      autoCloserRebuttalStyle: "AGGRESSIVE",
      autoCloserAutoDraft: true,
    },
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (typeof window !== "undefined") {
        const storedName = localStorage.getItem("outreachiq_display_name");
        if (storedName) {
          setDisplayName(storedName);
        }
      }

      const [accountData, settingsData, profileData] = await Promise.all([
        apiClient<any>("/api/gmail/account").catch(() => ({ accounts: [] })),
        fetch("/api/settings").then((r) => r.json()).catch(() => null),
        fetch("/api/user/profile").then((r) => r.json()).catch(() => null),
      ]);

      setAccounts(accountData.accounts ?? []);

      if (settingsData && !settingsData.error) {
        form.reset(settingsData);
      }

      if (profileData && !profileData.error) {
        if (profileData.name) setDisplayName(profileData.name);
        if (profileData.timezone) setTimezone(profileData.timezone);
        if (profileData.cooldown) setCooldown(profileData.cooldown);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(`${err.message}${err.detail ? ": " + err.detail : ""}`);
      } else {
        const msg = err instanceof Error ? err.message : "Failed to load settings data.";
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [form]);

  useEffect(() => {
    loadData();

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("connected") === "true") {
        const email = params.get("email");
        toast.success(`🎉 ${email ? "Gmail account " + email : "Gmail"} connected successfully! Watch subscription registered and inbox monitoring active.`);
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, [loadData]);

  const onSubmit = async (values: z.infer<typeof settingsSchema>) => {
    setIsUpdating(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!res.ok) throw new Error("Failed to save settings");
      toast.success("Settings updated successfully");
    } catch (err) {
      toast.error("Failed to update settings");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSaveProfile = async () => {
    setIsSavingProfile(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: displayName, timezone }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update profile");
      }

      if (data.cooldown) {
        setCooldown(data.cooldown);
      }

      localStorage.setItem("outreachiq_display_name", displayName);
      toast.success("Profile & Timezone preferences saved successfully!");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update profile";
      toast.error(msg);
    } finally {
      setIsSavingProfile(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 p-8 pt-6">
        <AnimatedPage><div className="animate-pulse h-96 bg-muted rounded-xl"></div></AnimatedPage>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Signature Silaer Header Banner */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-xs relative overflow-hidden transition-colors duration-200">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start sm:items-center gap-4">
            <div className="h-11 w-11 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
              <Zap className="h-5 w-5" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-bold text-foreground tracking-tight">
                  Platform Settings & Inboxes
                </h1>
                <TooltipProvider>
                  <Tooltip delayDuration={200}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="flex items-center justify-center h-5 w-5 rounded-full bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-help border border-border"
                      >
                        <Info className="h-3 w-3" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" align="center" className="max-w-xs p-3 bg-popover border border-border shadow-md rounded-lg z-50 text-xs">
                      <p className="font-semibold text-foreground mb-1">
                        Silaer Fleet & Preferences
                      </p>
                      <p className="text-muted-foreground leading-relaxed">
                        Configure connected Google Accounts, sending timezone windows, and deliverability limits.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
                Manage your account, rotating Gmail fleet, and operating timezone preferences.
              </p>
            </div>
          </div>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-8">
          <Tabs defaultValue="profile" className="flex flex-col md:flex-row gap-6">
            <TabsList className="flex flex-col h-auto bg-transparent p-0 space-y-1 md:w-48 lg:w-64">
              <TabsTrigger value="profile" className="w-full justify-start gap-2 px-3 py-2.5 rounded-lg data-[state=active]:bg-secondary data-[state=active]:text-foreground border border-transparent data-[state=active]:border-border font-medium text-xs"><User className="h-4 w-4" /> Profile & Timezone</TabsTrigger>
              <TabsTrigger value="gmail" className="w-full justify-start gap-2 px-3 py-2.5 rounded-lg data-[state=active]:bg-secondary data-[state=active]:text-foreground border border-transparent data-[state=active]:border-border font-medium text-xs"><Mail className="h-4 w-4" /> Gmail Integration</TabsTrigger>
            </TabsList>

              <div className="flex-1 max-w-3xl">
                <TabsContent value="profile" className="mt-0">
                  <Card className="border-border/50 shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-xl font-bold flex items-center gap-2">
                        <User className="h-5 w-5 text-primary" /> Profile & Workspace Timezone
                      </CardTitle>
                      <CardDescription>
                        Customize your display name and primary operating timezone for precise midnight limit resets.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Display Name */}
                      <div className="space-y-2 max-w-md">
                        <label className="text-sm font-semibold leading-none">Display Name</label>
                        <Input 
                          placeholder="E.g. Abdullah Hanjra" 
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                        />
                        <p className="text-[0.8rem] text-muted-foreground">
                          This name is used to personalize your dashboard experience.
                        </p>
                      </div>

                      {/* Timezone Selection */}
                      <div className="space-y-3 pt-2 border-t border-border/40 max-w-xl">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-semibold flex items-center gap-2">
                            <Globe className="h-4 w-4 text-primary" /> Workspace Timezone
                          </label>

                          {cooldown.canChange ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                              <CheckCircle2 className="h-3 w-3" /> Ready to modify
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 border border-amber-500/20">
                              <Lock className="h-3 w-3" /> Locked ({cooldown.remainingDays}d cooldown)
                            </span>
                          )}
                        </div>

                        <Select
                          value={timezone}
                          onValueChange={(val) => setTimezone(val)}
                          disabled={!cooldown.canChange || isSavingProfile}
                        >
                          <SelectTrigger className="w-full bg-background border-border shadow-sm">
                            <SelectValue placeholder="Select workspace timezone" />
                          </SelectTrigger>
                          <SelectContent className="max-h-[300px]">
                            {TIMEZONE_GROUPS.map((group) => (
                              <SelectGroup key={group.label}>
                                <SelectLabel className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                                  {group.label}
                                </SelectLabel>
                                {group.options.map((tz) => (
                                  <SelectItem key={tz.value} value={tz.value}>
                                    {tz.label} ({tz.offset})
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            ))}
                          </SelectContent>
                        </Select>

                        {/* Live Local Time Preview */}
                        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-border/50 text-xs">
                          <span className="text-muted-foreground flex items-center gap-2">
                            <Clock className="h-3.5 w-3.5 text-primary" /> Live Time in {timezone.split('/').pop()?.replace('_', ' ') || timezone}:
                          </span>
                          <span className="font-mono font-bold text-foreground bg-background px-2 py-0.5 rounded border border-border/40 shadow-xs">
                            {(() => {
                              try {
                                return new Intl.DateTimeFormat("en-US", {
                                  timeZone: timezone,
                                  hour: "numeric",
                                  minute: "2-digit",
                                  second: "2-digit",
                                  hour12: true,
                                }).format(currentTime);
                              } catch {
                                return "Invalid Timezone";
                              }
                            })()}
                          </span>
                        </div>

                        {/* Cooldown / Integrity Explanation Box */}
                        {!cooldown.canChange ? (
                          <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 space-y-1">
                            <p className="font-semibold flex items-center gap-1.5">
                              <ShieldCheck className="h-4 w-4 text-amber-600" /> Platform Rate-Limit Protection Active
                            </p>
                            <p className="opacity-90">
                              To prevent daily email capacity exploits, workspace timezones can only be changed once every 7 days. Your next available modification date is{" "}
                              <strong>
                                {cooldown.nextAllowedDate ? new Date(cooldown.nextAllowedDate).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : "in a few days"}
                              </strong>.
                            </p>
                          </div>
                        ) : (
                          <p className="text-[0.8rem] text-muted-foreground">
                            Your <strong>Daily Email Capacity</strong> automatically resets at exactly <strong>00:00:00 (Midnight)</strong> in this timezone. You can update this once every 7 days.
                          </p>
                        )}
                      </div>
                    </CardContent>
                    <CardFooter className="bg-muted/30 py-4 px-6 mt-4 border-t border-border/40 flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        Hourly velocity limits automatically reset at the top of every hour (:00:00).
                      </p>
                      <Button 
                        type="button" 
                        onClick={handleSaveProfile}
                        disabled={isSavingProfile}
                      >
                        {isSavingProfile ? "Saving..." : "Save Preferences"}
                      </Button>
                    </CardFooter>
                  </Card>
                </TabsContent>

                <TabsContent value="gmail" className="mt-0">
                  <div className="flex flex-col gap-6">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <h2 className="text-xl font-bold tracking-tight text-foreground">
                          Connected Gmail Accounts ({accounts.length})
                        </h2>
                        <p className="text-sm text-muted-foreground mt-1">Connect your Google Workspace accounts for multi-inbox smart rotation and automated outreach.</p>
                      </div>
                      <Button asChild className="gap-2 shadow-sm font-semibold">
                        <a href="/api/auth/gmail">
                          <Plus className="h-4 w-4" />
                          {accounts.length === 0 ? "Connect Gmail Account" : "Connect Another Inbox"}
                        </a>
                      </Button>
                    </div>

                    {/* Multi-Inbox Fleet Overview Banner */}
                    {accounts.length > 0 && (
                      <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 rounded-2xl p-5 shadow-sm space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-4">
                          <div className="space-y-1">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                              <Sparkles className="h-3.5 w-3.5" /> Multi-Inbox Fleet Engine
                            </span>
                            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                              ⚡ Smart Load Rotation & Sticky Thread Protection
                            </h3>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="px-3.5 py-1.5 bg-background/80 backdrop-blur rounded-xl border border-border/80 text-xs font-semibold text-foreground shadow-xs">
                              Total Fleet Capacity: <strong className="text-primary">{accounts.reduce((acc, a) => acc + (a.dailyLimit || 50), 0)} emails/day</strong>
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-muted-foreground">
                          <div className="flex items-center gap-2 bg-background/60 backdrop-blur p-2.5 rounded-xl border border-border/40">
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">🔒 Sticky Sender:</span>
                            <span>Thread continuity locked</span>
                          </div>
                          <div className="flex items-center gap-2 bg-background/60 backdrop-blur p-2.5 rounded-xl border border-border/40">
                            <span className="text-blue-600 dark:text-blue-400 font-bold">🔥 Auto-Ramp:</span>
                            <span>Domain reputation protected</span>
                          </div>
                          <div className="flex items-center gap-2 bg-background/60 backdrop-blur p-2.5 rounded-xl border border-border/40">
                            <span className="text-purple-600 dark:text-purple-400 font-bold">⏱️ Human Jitter:</span>
                            <span>15s–45s anti-spam delays</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {accounts.length === 0 ? (
                      <Card className="border-primary bg-primary/5 shadow-sm mt-2">
                        <CardContent className="p-8">
                          <div className="flex flex-col gap-2 items-center text-center">
                            <h3 className="text-xl font-bold text-foreground">No Gmail Account Connected</h3>
                            <p className="text-muted-foreground mb-4">
                              Connect your Gmail account via OAuth to start sending automated sequence emails and tracking replies.
                            </p>
                            <Button asChild>
                              <a href="/api/auth/gmail">Connect Gmail Account</a>
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="grid grid-cols-1 gap-4">
                        {accounts.map((acc) => (
                          <ConnectedAccountCard key={acc.email} account={acc} onAccountUpdated={loadData} />
                        ))}
                      </div>
                    )}
                  </div>
                </TabsContent>
              </div>
            </Tabs>
          </form>
        </Form>
    </div>
  );
}