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
import { Mail, Clock, Cpu, Bell, Key, Zap, User } from "lucide-react";

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
  const [displayName, setDisplayName] = useState("Team");

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
                <TabsTrigger value="profile" className="w-full justify-start gap-2 px-3 py-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary border border-transparent data-[state=active]:border-primary/20"><User className="h-4 w-4" /> Profile Details</TabsTrigger>
                <TabsTrigger value="gmail" className="w-full justify-start gap-2 px-3 py-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary border border-transparent data-[state=active]:border-primary/20"><Mail className="h-4 w-4" /> Gmail Integration</TabsTrigger>
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
                      {accounts.length === 0 && (
                        <Button asChild>
                          <a href="/api/auth/gmail">Add Account</a>
                        </Button>
                      )}
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

                <TabsContent value="profile" className="mt-0">
                  <Card className="border-border/50">
                    <CardHeader>
                      <CardTitle>Profile Details</CardTitle>
                      <CardDescription>
                        Update how your name appears on the dashboard banner.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 max-w-md">
                      <div className="space-y-2">
                        <label className="text-sm font-medium leading-none">Display Name</label>
                        <Input 
                          placeholder="E.g. Abdullah Hanjra" 
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                        />
                        <p className="text-[0.8rem] text-muted-foreground">
                          This name will be used to greet you on the dashboard.
                        </p>
                      </div>
                    </CardContent>
                    <CardFooter className="bg-muted/50 py-4 px-6 mt-4">
                      <Button 
                        type="button" 
                        onClick={() => {
                          localStorage.setItem("outreachiq_display_name", displayName);
                          toast.success("Profile name updated successfully");
                        }}
                      >
                        Save Profile
                      </Button>
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