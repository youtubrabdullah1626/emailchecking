"use client";

import React from "react";
import { useWarmup } from "@/components/providers/WarmupProvider";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Progress } from "@/components/ui/progress";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { LegacyLoadingState as LoadingState, LegacyBadge as Badge } from "@/components/ui/legacy-adapters";
import { StatusBadge } from "@/components/ui/status-badge";
import { Flame, Activity, Zap, Play, CheckCircle, PauseCircle } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

const warmupSchema = z.object({
  enabled: z.boolean(),
  businessDaysOnly: z.boolean(),
  startingDailyEmails: z.coerce.number().min(1).max(50),
  maxDailyEmails: z.coerce.number().min(5).max(200),
  warmupDurationDays: z.coerce.number().min(7).max(90),
  sendingWindow: z.string().min(1),
  timezone: z.string().min(1),
});

export function WarmupTab() {
  const { settings, status, todaySchedule, isLoading, isSaving, updateSettings } = useWarmup();

  const form = useForm<z.infer<typeof warmupSchema>>({
    resolver: zodResolver(warmupSchema) as any,
    defaultValues: settings || {
      enabled: false,
      businessDaysOnly: true,
      startingDailyEmails: 5,
      maxDailyEmails: 40,
      warmupDurationDays: 30,
      sendingWindow: "09:00-17:00",
      timezone: "UTC",
    },
  });

  // Update form values when settings are loaded
  React.useEffect(() => {
    if (settings) {
      form.reset(settings);
    }
  }, [settings, form]);

  if (isLoading) {
    return <LoadingState message="Loading warmup configuration..." />;
  }

  if (!settings || !status) {
    return null;
  }

  const onSubmit = async (values: z.infer<typeof warmupSchema>) => {
    await updateSettings(values);
  };

  const getStatusIcon = () => {
    switch (status.status) {
      case "ACTIVE": return <Play className="h-4 w-4 text-emerald-500" />;
      case "PAUSED": return <PauseCircle className="h-4 w-4 text-amber-500" />;
      case "COMPLETED": return <CheckCircle className="h-4 w-4 text-blue-500" />;
      default: return <Activity className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusLabel = () => {
    switch (status.status) {
      case "ACTIVE": return "warming up";
      case "PAUSED": return "paused";
      case "COMPLETED": return "completed";
      default: return "not started";
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Card className="border-border shadow-sm">
        <CardHeader className="bg-muted/5">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <CardTitle>Warmup Overview</CardTitle>
          </div>
          <CardDescription>Monitor the current infrastructure health and warmup progress.</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          {/* Top Section: Overview KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-muted-foreground">Status</span>
              <div className="flex items-center gap-2">
                {getStatusIcon()}
                <span className="font-semibold text-foreground capitalize">{status.status.replace("_", " ")}</span>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-muted-foreground">Current Warmup Day</span>
              <span className="font-semibold text-foreground">Day {status.currentDay} of {settings.warmupDurationDays}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-muted-foreground">Current Daily Target</span>
              <span className="font-semibold text-foreground">{status.dailyTarget} Emails</span>
            </div>
          </div>
          
          {/* Middle Section: Progress & Telemetry */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8 pt-6 border-t border-border/50">
            {/* Column 1: Progress */}
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-foreground">Warmup Progress</span>
                  <span className="text-muted-foreground">{status.progressPercent}%</span>
                </div>
                <Progress value={status.progressPercent} className="h-2" />
                <p className="text-xs text-muted-foreground pt-1">{status.remainingDays} days remaining until target volume</p>
              </div>
              <div className="bg-muted/10 rounded-md p-3 border border-border/50 flex flex-col gap-1">
                <span className="text-xs font-medium text-foreground">Target Trajectory</span>
                <span className="text-xs text-muted-foreground">
                  Starting: {settings.startingDailyEmails} &nbsp;|&nbsp; 
                  Current: <span className="text-foreground font-medium">{status.dailyTarget}</span> &nbsp;|&nbsp; 
                  Maximum: {settings.maxDailyEmails}
                </span>
              </div>
            </div>

            {/* Column 2: Telemetry */}
            <div className="space-y-4 flex flex-col justify-center">
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-muted-foreground">Last Execution</span>
                <span className="font-semibold text-foreground">
                  {(() => {
                    if (!todaySchedule || todaySchedule.length === 0) return "Not executed yet";
                    const now = new Date();
                    const nowStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
                    const past = todaySchedule.filter(t => t <= nowStr);
                    return past.length > 0 ? past[past.length - 1] : "Not executed yet";
                  })()}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-muted-foreground">Next Execution</span>
                <span className="font-semibold text-foreground">
                  {(() => {
                    if (!todaySchedule || todaySchedule.length === 0) return "No schedule today";
                    const now = new Date();
                    const nowStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
                    const future = todaySchedule.filter(t => t > nowStr);
                    return future.length > 0 ? future[0] : "Today's schedule completed";
                  })()}
                </span>
              </div>
            </div>
          </div>

          {/* Bottom Section: Schedule */}
          {todaySchedule && todaySchedule.length > 0 && (
            <div className="mt-8 pt-6 border-t border-border/50">
              <span className="text-sm font-medium text-foreground mb-4 block">Today&apos;s Smart Schedule ({todaySchedule.length} emails)</span>
              <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-1">
                {todaySchedule.map((time, i) => (
                  <Badge key={i} variant="neutral" className="font-mono text-xs text-muted-foreground bg-muted/20">
                    {time}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          {todaySchedule && todaySchedule.length === 0 && (
            <div className="mt-8 pt-6 border-t border-border/50">
               <span className="text-sm font-medium text-muted-foreground block">No emails scheduled for today.</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card className="border-border shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Flame className="h-5 w-5 text-orange-500" />
                <CardTitle>Configuration</CardTitle>
              </div>
              <CardDescription>Adjust the daily volume ramp and sending windows.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              
              <FormField
                control={form.control}
                name="enabled"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border p-4 bg-card shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Enable Automatic Warmup</FormLabel>
                      <FormDescription>
                        Automatically send and receive emails within our network to build reputation.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-border/50">
                <FormField
                  control={form.control}
                  name="startingDailyEmails"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Starting Daily Volume</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormDescription>Number of emails to send on Day 1.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="maxDailyEmails"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Maximum Daily Target</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormDescription>The peak volume you want to reach.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="warmupDurationDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ramp Up Duration (Days)</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormDescription>How many days it takes to reach maximum volume.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="businessDaysOnly"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border p-4 bg-card h-[88px]">
                      <div className="space-y-0.5">
                        <FormLabel>Business Days Only</FormLabel>
                        <FormDescription>Skip sending on weekends.</FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="sendingWindow"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sending Window</FormLabel>
                      <FormControl>
                        <Input placeholder="09:00-17:00" {...field} />
                      </FormControl>
                      <FormDescription>Time range to distribute emails (HH:MM-HH:MM).</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="timezone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Timezone</FormLabel>
                      <FormControl>
                        <select 
                          className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          value={field.value}
                          onChange={field.onChange}
                        >
                          <option value="UTC">UTC</option>
                          <option value="America/New_York">Eastern Time (ET)</option>
                          <option value="America/Chicago">Central Time (CT)</option>
                          <option value="America/Denver">Mountain Time (MT)</option>
                          <option value="America/Los_Angeles">Pacific Time (PT)</option>
                          <option value="Europe/London">London (GMT/BST)</option>
                        </select>
                      </FormControl>
                      <FormDescription>Timezone for the sending window.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
            </CardContent>
            <CardFooter className="bg-muted/50 border-t border-border px-6 py-4">
              <Button type="submit" disabled={isSaving || !form.formState.isDirty}>
                {isSaving ? "Saving..." : "Save Configuration"}
              </Button>
            </CardFooter>
          </Card>
        </form>
      </Form>
    </div>
  );
}
