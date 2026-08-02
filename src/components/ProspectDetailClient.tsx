"use client";

import React, { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Prospect } from "@prisma/client";
import type { SequenceWithSteps } from "@/lib/db/sequences";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { ArrowLeft, Mail, Building, Globe, Clock, Plus } from "lucide-react";

import { AnimatedPage } from "@/components/ui/animated";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ProspectForm from "@/components/ProspectForm";
import useSWR from "swr";
import { LegacyLoadingState as LoadingState, LegacyErrorState as ErrorState } from "@/components/ui/legacy-adapters";
import { Check, X, Play, MessageSquare } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface ProspectDetailClientProps {
  prospect: Prospect;
  sequence: SequenceWithSteps | null;
}

function ProspectDetailClientComponent({ prospect, sequence }: ProspectDetailClientProps) {
  const router = useRouter();

  const { data: activityData, error: activityError, isLoading: isActivityLoading } = useSWR(`/api/prospects/${prospect.id}/activity`, fetcher);
  
  const activity = activityData?.activity || [];

  let prospectBadgeStatus = 'none';
  if (prospect.status === "ACTIVE") prospectBadgeStatus = 'active';
  else if (prospect.status === "REPLIED") prospectBadgeStatus = 'completed';
  else if (prospect.status === "STOPPED") prospectBadgeStatus = 'error';
  else if (prospect.status === "COMPLETED") prospectBadgeStatus = 'completed';

  return (
    <AnimatedPage className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <Link href="/prospects" className="hover:text-foreground flex items-center gap-1">
          <ArrowLeft className="h-3 w-3" /> Back to prospects
        </Link>
      </div>

      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="h-32 bg-gradient-to-r from-primary/20 to-primary/5"></div>
        <div className="px-8 pb-8 relative">
          <div className="flex justify-between items-end">
            <Avatar className="h-24 w-24 border-4 border-card bg-card -mt-12">
              <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">
                {prospect.name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex gap-3">
              <Button variant="outline" size="sm" asChild>
                <Link href={`/prospects/${prospect.id}/edit`}>Edit</Link>
              </Button>
              <Button size="sm" className="gap-2" asChild>
                <Link href={`/prospects/${prospect.id}/sequence`}>
                  <Plus className="h-4 w-4" /> {sequence ? "View Sequence" : "Add to Sequence"}
                </Link>
              </Button>
            </div>
          </div>
          
          <div className="mt-4">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">{prospect.name}</h1>
              <StatusBadge status={prospectBadgeStatus as any} dot />
            </div>
            
            <div className="flex flex-wrap gap-x-6 gap-y-2 mt-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Building className="h-4 w-4" />
                {prospect.company || "No company"}
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                {prospect.email}
              </div>
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                {prospect.timezone || "Unknown TZ"}
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Added {prospect.created_at ? formatDistanceToNow(new Date(prospect.created_at), { addSuffix: true }) : "Unknown"}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="activity" className="w-full">
        <TabsList className="bg-card border border-border h-12 w-full justify-start rounded-lg px-2 shadow-sm">
          <TabsTrigger value="activity" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary">Activity</TabsTrigger>
          <TabsTrigger value="sequence">Sequence</TabsTrigger>
          <TabsTrigger value="profile">Profile Details</TabsTrigger>
        </TabsList>
        
        <TabsContent value="activity" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
                {isActivityLoading ? (
                  <LoadingState message="Loading activity timeline..." />
                ) : activityError ? (
                  <ErrorState title="Failed to load activity" message="An error occurred while loading the timeline." />
                ) : activity.map((event: any, index: number) => {
                  let Icon = Plus;
                  let iconColor = "text-primary";
                  let badgeStatus = "none";
                  let bgVariant = "bg-primary/10";
                  
                  if (event.type === "SENT") {
                    Icon = Check;
                    iconColor = "text-green-500";
                    badgeStatus = "completed";
                    bgVariant = "bg-green-500/10";
                  } else if (event.type === "FAILED") {
                    Icon = X;
                    iconColor = "text-destructive";
                    badgeStatus = "error";
                    bgVariant = "bg-destructive/10";
                  } else if (event.type === "REPLY") {
                    Icon = MessageSquare;
                    iconColor = "text-orange-500";
                    badgeStatus = "completed";
                    bgVariant = "bg-orange-500/10";
                  } else if (event.type === "SEQUENCE_STARTED") {
                    Icon = Play;
                    iconColor = "text-blue-500";
                    badgeStatus = "active";
                    bgVariant = "bg-blue-500/10";
                  }

                  return (
                    <div key={event.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                      <div className={`flex items-center justify-center w-10 h-10 rounded-full border border-border shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm z-10 ${bgVariant}`}>
                        <Icon className={`h-4 w-4 ${iconColor}`} />
                      </div>
                      <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-border bg-card shadow-sm">
                        <div className="flex items-center justify-between mb-1">
                          <StatusBadge status={badgeStatus as any} label={event.type} />
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(event.createdAt), { addSuffix: true })}
                          </span>
                        </div>
                        <p className="text-sm text-foreground mt-2">{event.description}</p>
                      </div>
                    </div>
                  );
                })}
                {!isActivityLoading && !activity.length && (
                  <div className="text-center py-8 text-muted-foreground text-sm relative z-10 bg-card rounded-xl border border-border shadow-sm max-w-sm mx-auto">
                    No activity recorded yet
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="sequence" className="mt-6">
          <Card>
            <CardContent className="py-12 text-center flex flex-col items-center">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-4">
                <Clock className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-medium text-foreground mb-1">
                {sequence ? `Enrolled in Sequence (${sequence.status})` : "Not in any sequence"}
              </h3>
              <p className="text-muted-foreground text-sm max-w-md mx-auto mb-6">
                {sequence 
                  ? `This prospect is currently enrolled in a sequence with ${sequence.steps.length} step(s).` 
                  : "This prospect is not currently enrolled in any active sequences. Add them to a sequence to start automated outreach."}
              </p>
              <Button asChild>
                <Link href={`/prospects/${prospect.id}/sequence`}>
                  {sequence ? "View Sequence" : "Enroll in Sequence"}
                </Link>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="profile" className="mt-6">
          <Card>
            <CardContent className="p-6">
              {/* Render the read-only details or the form */}
              <div className="max-w-[600px]">
                <div className="flex flex-col gap-6">
                  <div>
                    <span className="text-sm font-medium text-muted-foreground block mb-1">Notes</span>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{prospect.notes || "No notes provided."}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AnimatedPage>
  );
}

export default React.memo(ProspectDetailClientComponent);
