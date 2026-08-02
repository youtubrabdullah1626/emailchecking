"use client";

import React, { useState } from "react";
import useSWR from "swr";
import { format } from "date-fns";
import { ArrowLeft, Mail, ShieldAlert, Activity, ServerCog, Zap } from "lucide-react";
import Link from "next/link";
import { LegacyPageHeader as PageHeader } from "@/components/ui/legacy-adapters";
import { LegacyLoadingState as LoadingState, LegacyErrorState as ErrorState } from "@/components/ui/legacy-adapters";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) throw new Error("Failed to load user details");
  return res.json();
});

const getStringColor = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 65%, 45%)`; // Rich, readable colors like WhatsApp
};

export default function UserDetailPage({ params }: { params: { email: string } }) {
  const decodedEmail = decodeURIComponent(params.email);
  const { data, error, isLoading, mutate } = useSWR(`/api/admin/users/${encodeURIComponent(decodedEmail)}`, fetcher, {
    keepPreviousData: true
  });

  const user = data?.data;
  const activity = data?.activity || [];
  
  const [isEditing, setIsEditing] = useState(false);
  const [dailyLimit, setDailyLimit] = useState(0);
  const [hourlyLimit, setHourlyLimit] = useState(0);

  // Initialize state once data loads
  React.useEffect(() => {
    if (user && !isEditing) {
      setDailyLimit(user.daily_limit);
      setHourlyLimit(user.hourly_limit);
    }
  }, [user, isEditing]);

  const handleSave = async () => {
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(decodedEmail)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ daily_limit: dailyLimit, hourly_limit: hourlyLimit })
      });
      if (!res.ok) throw new Error("Failed to save");
      toast.success("Limits updated successfully");
      setIsEditing(false);
      mutate();
    } catch (err) {
      toast.error("Failed to update limits");
    }
  };

  if (error) {
    return (
      <div className="flex-1 p-8 pt-6">
        <ErrorState 
          title="Failed to load user" 
          message={typeof error === 'string' ? error : "An unexpected error occurred."} 
          onRetry={() => window.location.reload()} 
        />
      </div>
    );
  }

  if (isLoading && !user) {
    return (
      <div className="flex-1 p-8 pt-6">
        <LoadingState message={`Fetching details for ${decodedEmail}...`} />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex-1 space-y-6 p-8 pt-6 h-full flex flex-col overflow-y-auto">
      <div>
        <Link href="/admin/users" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-primary mb-4 transition-colors">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Active Users
        </Link>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 border-2 border-border shadow-sm" style={{ backgroundColor: getStringColor(user.email) }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`https://unavatar.io/google/${user.email}?fallback=false`} alt={user.email} className="object-cover w-full h-full" onError={(e) => {
                e.currentTarget.style.display = 'none';
              }} />
              <AvatarFallback className="text-white text-xl font-bold bg-transparent">
                {user.email.substring(0, 1).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
                {user.email}
              </h1>
              <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                <StatusBadge 
                  status={user.connection_status === "CONNECTED" ? "active" : "error"} 
                  label={user.connection_status} 
                  dot 
                />
                • Registered {format(new Date(user.created_at), "MMM d, yyyy")}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        {/* Left Column: Editable Limits */}
        <div className="md:col-span-1 space-y-6">
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-3 border-b border-border/50 bg-muted/20">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                  <ServerCog className="h-4 w-4 text-primary" />
                  Sending Constraints
                </CardTitle>
                {!isEditing ? (
                  <button onClick={() => setIsEditing(true)} className="text-xs text-primary font-semibold hover:underline">Edit</button>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={() => setIsEditing(false)} className="text-xs text-muted-foreground font-semibold hover:underline">Cancel</button>
                    <button onClick={handleSave} className="text-xs text-primary font-semibold hover:underline">Save</button>
                  </div>
                )}
              </div>
              <CardDescription className="text-xs mt-1">Configure absolute throttle limits.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="flex flex-col gap-2 py-2 border-b border-border/50">
                <span className="text-sm font-medium text-muted-foreground">Maximum Daily Limit</span>
                {isEditing ? (
                  <Input type="number" value={dailyLimit} onChange={e => setDailyLimit(Number(e.target.value))} className="h-8" />
                ) : (
                  <span className="text-xl font-bold">{user.daily_limit}</span>
                )}
              </div>
              <div className="flex flex-col gap-2 py-2">
                <span className="text-sm font-medium text-muted-foreground">Maximum Hourly Limit</span>
                {isEditing ? (
                  <Input type="number" value={hourlyLimit} onChange={e => setHourlyLimit(Number(e.target.value))} className="h-8" />
                ) : (
                  <span className="text-xl font-bold">{user.hourly_limit}</span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Activity & Engagement */}
        <div className="md:col-span-2 space-y-6">
          <Card className="border-border shadow-sm h-full flex flex-col">
            <CardHeader className="pb-3 border-b border-border/50 bg-muted/20">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                <Activity className="h-4 w-4 text-primary" />
                Today&apos;s Sending Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 flex-1 flex flex-col justify-center">
              <div className="grid grid-cols-2 gap-8">
                <div className="text-center p-6 bg-muted/30 rounded-xl border border-border/50">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Sent Today</h4>
                  <div className="text-4xl font-black text-blue-600 dark:text-blue-500">
                    {user.sent_today}
                  </div>
                  <div className="mt-2 text-xs font-medium text-muted-foreground">
                    out of {user.daily_limit} max
                  </div>
                </div>
                
                <div className="text-center p-6 bg-muted/30 rounded-xl border border-border/50">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Sent This Hour</h4>
                  <div className="text-4xl font-black text-indigo-600 dark:text-indigo-500">
                    {user.sent_this_hour}
                  </div>
                  <div className="mt-2 text-xs font-medium text-muted-foreground">
                    out of {user.hourly_limit} max
                  </div>
                </div>
              </div>
              
              <div className="mt-8 pt-6 border-t border-border/50">
                <div className="flex items-center gap-3 p-4 bg-primary/5 border border-primary/20 rounded-lg">
                  <Zap className="h-5 w-5 text-primary" />
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-primary">Connection Secure</span>
                    <span className="text-xs text-muted-foreground">OAuth tokens are valid and actively syncing.</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-3 border-b border-border/50 bg-muted/20">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                <Activity className="h-4 w-4 text-primary" />
                Live Dispatch Log
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {activity.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  No recent dispatch events found for this account.
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {activity.map((event: any) => {
                    const prospectEmail = event.step?.sequence?.prospect?.email;
                    const prospectName = event.step?.sequence?.prospect?.name || prospectEmail || "Unknown Prospect";
                    
                    return (
                    <div key={event.id} className="p-4 flex items-center justify-between hover:bg-muted/10 transition-colors">
                      <div className="flex items-center gap-4">
                        <Avatar className="h-10 w-10 border border-border shadow-sm" style={{ backgroundColor: prospectEmail ? getStringColor(prospectEmail) : 'hsl(0,0%,80%)' }}>
                          {prospectEmail ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img src={`https://unavatar.io/google/${prospectEmail}?fallback=false`} alt={prospectName} className="object-cover w-full h-full" onError={(e) => {
                              // If unavatar fails or finds nothing, hide image to show fallback
                              e.currentTarget.style.display = 'none';
                            }} />
                          ) : null}
                          <AvatarFallback className="text-white font-bold bg-transparent text-sm">
                            {prospectName !== "Unknown Prospect" ? prospectName.substring(0, 1).toUpperCase() : "?"}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="text-sm font-bold text-foreground">
                            {prospectName}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {event.event_type} • Step {event.step?.step_number || "?"}
                          </div>
                        </div>
                      </div>
                      <div className="text-xs font-medium text-muted-foreground bg-muted/50 px-2 py-1 rounded">
                        {format(new Date(event.occurred_at), "h:mm a")}
                      </div>
                    </div>
                  )})}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
