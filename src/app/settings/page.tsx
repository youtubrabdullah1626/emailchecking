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
import { Mail, Clock, Cpu, Bell, Key, Zap } from "lucide-react";

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
      const [accountData, settingsData] = await Promise.all([
        apiClient<any>("/api/gmail/account").catch(() => ({ accounts: [] })),
        fetch("/api/settings").then(r => r.json()).catch(() => null)
      ]);
      setAccounts(accountData.accounts ?? []);
      
      if (settingsData && !settingsData.error) {
        form.reset(settingsData);
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

  if (loading) {
    return (
      <div className="flex-1 p-8 pt-6">
        <AnimatedPage><div className="animate-pulse h-96 bg-muted rounded-xl"></div></AnimatedPage>
      </div>
    );
  }

  return (
    <div className="flex-1 p-8 pt-6">
      <AnimatedPage className="space-y-6">
        <PageHeader 
          title="Settings" 
          description="Manage your account, API integrations, and platform preferences."
        />

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-8">
            <Tabs defaultValue="gmail" className="flex flex-col md:flex-row gap-6">
              <TabsList className="flex flex-col h-auto bg-transparent p-0 space-y-1 md:w-48 lg:w-64">
                <TabsTrigger value="gmail" className="w-full justify-start gap-2 px-3 py-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary border border-transparent data-[state=active]:border-primary/20"><Mail className="h-4 w-4" /> Gmail Integration</TabsTrigger>
                <TabsTrigger value="gemini" className="w-full justify-start gap-2 px-3 py-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary border border-transparent data-[state=active]:border-primary/20"><Cpu className="h-4 w-4" /> Gemini AI</TabsTrigger>
                <TabsTrigger value="scheduler" className="w-full justify-start gap-2 px-3 py-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary border border-transparent data-[state=active]:border-primary/20"><Clock className="h-4 w-4" /> Scheduler</TabsTrigger>
                <TabsTrigger value="notifications" className="w-full justify-start gap-2 px-3 py-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary border border-transparent data-[state=active]:border-primary/20"><Bell className="h-4 w-4" /> Notifications</TabsTrigger>
                <TabsTrigger value="warmup" className="w-full justify-start gap-2 px-3 py-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary border border-transparent data-[state=active]:border-primary/20"><Zap className="h-4 w-4 text-orange-500" /> AI Auto-Closer</TabsTrigger>
              </TabsList>

              <div className="flex-1 max-w-3xl">
                <TabsContent value="gmail" className="mt-0">
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-wrap items-center justify-between">
                      <div>
                        <h2 className="text-xl font-bold tracking-tight text-foreground">
                          Connected Gmail Accounts ({accounts.length})
                        </h2>
                        <p className="text-sm text-muted-foreground mt-1">Connect your Google Workspace accounts for sending outreach.</p>
                      </div>
                      <Button asChild>
                        <a href="/api/auth/gmail">Add Account</a>
                      </Button>
                    </div>

                    {accounts.length === 0 ? (
                      <Card className="border-primary bg-primary/5 shadow-sm mt-4">
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
                      <div className="grid grid-cols-1 gap-4 mt-4">
                        {accounts.map((acc) => (
                          <ConnectedAccountCard key={acc.email} account={acc} onAccountUpdated={loadData} />
                        ))}
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="gemini" className="mt-0">
                  <Card className="border-border shadow-sm">
                    <CardHeader>
                      <CardTitle>Gemini AI Integration</CardTitle>
                      <CardDescription>Configure AI for intelligent reply parsing and sentiment analysis.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <FormField
                        control={form.control as any}
                        name="geminiEnabled"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border p-4 bg-card shadow-sm">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">Enable Gemini Analysis</FormLabel>
                              <FormDescription>
                                Automatically scan incoming replies to categorize sentiment and extract intents.
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control as any}
                        name="geminiModel"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Model Selection</FormLabel>
                            <FormControl>
                              <Input placeholder="gemini-1.5-pro-latest" {...field} />
                            </FormControl>
                            <FormDescription>The specific model version to use for parsing.</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                    <CardFooter className="bg-muted/50 border-t border-border px-6 py-4">
                      <Button type="submit" disabled={isUpdating}>Save Changes</Button>
                    </CardFooter>
                  </Card>
                </TabsContent>

                <TabsContent value="scheduler" className="mt-0">
                  <Card className="border-border shadow-sm">
                    <CardHeader>
                      <CardTitle>Scheduler Configuration</CardTitle>
                      <CardDescription>Manage the background job runner.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <FormField
                        control={form.control as any}
                        name="schedulerEnabled"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border p-4 bg-card shadow-sm">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">Enable Scheduler Engine</FormLabel>
                              <FormDescription>
                                If disabled, sequences will not advance automatically.
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control as any}
                        name="schedulerCron"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Cron Expression</FormLabel>
                            <FormControl>
                              <Input placeholder="*/5 * * * *" {...field} />
                            </FormControl>
                            <FormDescription>Standard cron syntax for how often to check for pending tasks.</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                    <CardFooter className="bg-muted/50 border-t border-border px-6 py-4">
                      <Button type="submit" disabled={isUpdating}>Save Changes</Button>
                    </CardFooter>
                  </Card>
                </TabsContent>

                <TabsContent value="notifications" className="mt-0">
                  <Card className="border-border shadow-sm">
                    <CardHeader>
                      <CardTitle>Notifications</CardTitle>
                      <CardDescription>Control when you receive alerts from the platform.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <FormField
                        control={form.control as any}
                        name="notificationsEnabled"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border p-4 bg-card shadow-sm">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">Global Notifications</FormLabel>
                              <FormDescription>Master switch for all alerts.</FormDescription>
                            </div>
                            <FormControl>
                              <Switch checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      
                      <div className="pl-4 space-y-4 border-l-2 border-border ml-2">
                        <FormField
                          control={form.control as any}
                          name="notifyOnReply"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between">
                              <div className="space-y-0.5">
                                <FormLabel>New Replies</FormLabel>
                                <FormDescription>Alert when a prospect responds to a sequence.</FormDescription>
                              </div>
                              <FormControl>
                                <Switch checked={field.value} onCheckedChange={field.onChange} disabled={!form.watch('notificationsEnabled')} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control as any}
                          name="notifyOnFailure"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between">
                              <div className="space-y-0.5">
                                <FormLabel>Send Failures</FormLabel>
                                <FormDescription>Alert when an email fails to deliver or bounces.</FormDescription>
                              </div>
                              <FormControl>
                                <Switch checked={field.value} onCheckedChange={field.onChange} disabled={!form.watch('notificationsEnabled')} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                    </CardContent>
                    <CardFooter className="bg-muted/50 border-t border-border px-6 py-4">
                      <Button type="submit" disabled={isUpdating}>Save Changes</Button>
                    </CardFooter>
                  </Card>
                </TabsContent>

                <TabsContent value="warmup" className="mt-0">
                  <Card className="border-orange-500/20 shadow-md">
                    <CardHeader className="bg-orange-500/5">
                      <div className="flex items-center gap-2">
                        <Zap className="h-5 w-5 text-orange-500" />
                        <CardTitle>AI Objection Handler & Auto-Closer</CardTitle>
                      </div>
                      <CardDescription>Automatically analyze replies, detect objections, and generate rebuttals to close meetings on autopilot.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6 pt-6">
                      <FormField
                        control={form.control as any}
                        name="autoCloserEnabled"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border p-4 bg-card shadow-sm">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">Enable AI Auto-Closer</FormLabel>
                              <FormDescription>
                                Uses deep AI models to instantly craft hyper-personalized rebuttals when a prospect objects.
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <div className="grid gap-6 md:grid-cols-2">
                        <FormField
                          control={form.control as any}
                          name="autoCloserRebuttalStyle"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Rebuttal Style</FormLabel>
                              <FormControl>
                                <select 
                                  className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                  disabled={!form.watch('autoCloserEnabled')}
                                  value={field.value}
                                  onChange={field.onChange}
                                >
                                  <option value="AGGRESSIVE">Aggressive (Push for Meeting)</option>
                                  <option value="CONSULTATIVE">Consultative (Provide Value)</option>
                                  <option value="PASSIVE">Passive (Check Later)</option>
                                </select>
                              </FormControl>
                              <FormDescription>How the AI should handle objections.</FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control as any}
                          name="autoCloserAutoDraft"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border p-4 bg-card shadow-sm h-full">
                              <div className="space-y-0.5">
                                <FormLabel>Auto-Draft in Gmail</FormLabel>
                                <FormDescription>
                                  Save the generated rebuttal directly to your Gmail Drafts folder.
                                </FormDescription>
                              </div>
                              <FormControl>
                                <Switch checked={field.value} onCheckedChange={field.onChange} disabled={!form.watch('autoCloserEnabled')} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                    </CardContent>
                    <CardFooter className="bg-muted/50 border-t border-border px-6 py-4">
                      <Button type="submit" disabled={isUpdating} className="bg-orange-500 hover:bg-orange-600 text-white">Save Auto-Closer Settings</Button>
                    </CardFooter>
                  </Card>
                </TabsContent>
              </div>
            </Tabs>
          </form>
        </Form>
      </AnimatedPage>
    </div>
  );
}