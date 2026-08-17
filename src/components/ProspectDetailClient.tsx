"use client";

import React, { useState, useCallback, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Prospect } from "@prisma/client";
import type { SequenceWithSteps } from "@/lib/db/sequences";
import { formatDistanceToNow, format } from "date-fns";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { ArrowLeft, Mail, Building, Globe, Clock, Plus, Loader2 } from "lucide-react";

import { AnimatedPage } from "@/components/ui/animated";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ProspectForm from "@/components/ProspectForm";
import { QuickEmailComposer } from "@/components/QuickEmailComposer";
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
  const [isPending, startTransition] = useTransition();
  const [isComposerOpen, setIsComposerOpen] = useState(false);

  const { data: activityData, error: activityError, isLoading: isActivityLoading, mutate: mutateActivity } = useSWR(
    `/api/prospects/${prospect.id}/activity`, 
    fetcher,
    { refreshInterval: 5000 }
  );
  
  const activity = activityData?.activity || [];

  let prospectBadgeStatus = 'none';
  if (prospect.status === "ACTIVE") {
    if (!sequence && activity.filter((a: any) => a.type.includes("EMAIL")).length === 0) {
      prospectBadgeStatus = 'uncontacted';
    } else {
      prospectBadgeStatus = 'active';
    }
  }
  else if (prospect.status === "REPLIED") prospectBadgeStatus = 'completed'; // Replied maps to completed style usually or replied if defined
  else if (prospect.status === "STOPPED") prospectBadgeStatus = 'error';
  else if (prospect.status === "COMPLETED") prospectBadgeStatus = 'completed';

  return (
    <AnimatedPage className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <Link prefetch={true} href="/prospects" className="hover:text-foreground flex items-center gap-1">
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
            <div className="flex flex-wrap gap-3">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" className="gap-2">
                    Reset Prospect
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete all sent emails, sequence enrollments, and activity history for <strong>{prospect.name}</strong>. They will look like a brand new prospect. This action cannot be reversed.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={async () => {
                        try {
                          const res = await fetch(`/api/prospects/${prospect.id}/reset`, { method: "DELETE" });
                          if (!res.ok) throw new Error("Failed to reset");
                          toast.success("Prospect history completely wiped!");
                          mutateActivity();
                          router.refresh();
                        } catch (error) {
                          toast.error("Failed to reset prospect");
                        }
                      }}
                    >
                      Yes, reset prospect
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button variant="outline" size="sm" asChild>
                <Link prefetch={true} href={`/prospects/${prospect.id}/edit`}>Edit</Link>
              </Button>
              
              <Button 
                variant="secondary"
                size="sm" 
                className="gap-2"
                onClick={() => setIsComposerOpen(true)}
              >
                <Mail className="h-4 w-4" />
                Send Email
              </Button>

              <Button 
                size="sm" 
                className="gap-2 min-w-[150px]" 
                disabled={isPending}
                onClick={() => {
                  startTransition(() => router.push(`/prospects/${prospect.id}/sequence`));
                }}
              >
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  sequence ? <Play className="h-4 w-4" /> : <Plus className="h-4 w-4" />
                )}
                {isPending ? "Loading..." : (sequence ? "View Sequence" : "Add to Sequence")}
              </Button>
            </div>
          </div>
          
          <QuickEmailComposer
            prospectId={prospect.id}
            isOpen={isComposerOpen}
            onOpenChange={setIsComposerOpen}
            hasActiveSequence={!!sequence && sequence.status === "ACTIVE"}
            onSuccess={() => {
              mutateActivity();
              setTimeout(() => mutateActivity(), 1500);
            }}
          />
          
          <div className="mt-4">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">{prospect.name}</h1>
              <StatusBadge status={prospectBadgeStatus as any} />
            </div>
            
            <div className="flex flex-wrap gap-4 mt-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Building className="h-4 w-4" />
                {prospect.company || "Unknown Company"}
              </div>
              <div className="flex items-center gap-1.5">
                <Mail className="h-4 w-4" />
                <a href={`mailto:${prospect.email}`} className="hover:underline text-foreground">
                  {prospect.email}
                </a>
              </div>
              <div className="flex items-center gap-1.5">
                <Globe className="h-4 w-4" />
                {prospect.timezone || "UTC"}
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                Added {formatDistanceToNow(new Date(prospect.created_at), { addSuffix: true })}
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
              <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
                {isActivityLoading ? (
                  <LoadingState message="Loading activity timeline..." />
                ) : activityError ? (
                  <ErrorState title="Failed to load activity" message="An error occurred while loading the timeline." />
                ) : (() => {
                  const filteredActivity = activity.filter((e: any) => 
                    ["EMAIL_SENT", "SCHEDULED_EMAIL", "REPLY", "FAILED", "SEQUENCE_STARTED"].includes(e.type)
                  );
                  
                  if (filteredActivity.length === 0) {
                    return (
                      <div className="text-center py-8 text-muted-foreground text-sm relative z-10 bg-card rounded-xl border border-border shadow-sm max-w-sm mx-auto">
                        No emails sent yet
                      </div>
                    );
                  }

                  return filteredActivity.map((event: any, index: number) => {
                    let Icon = Plus;
                  let iconColor = "text-primary";
                  let badgeStatus = "none";
                  let bgVariant = "bg-primary/10";
                  
                  if (event.type === "EMAIL_SENT") {
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
                  } else if (event.type === "SCHEDULED_EMAIL") {
                    Icon = Clock;
                    iconColor = "text-purple-500";
                    badgeStatus = "pending";
                    bgVariant = "bg-purple-500/10";
                  }

                  return (
                    <div key={event.id} className="relative flex items-start gap-4 group is-active">
                      {/* Solid bg-card wrapper to hide the vertical line, then colored background */}
                      <div className="flex items-center justify-center w-10 h-10 rounded-full border border-border shrink-0 shadow-sm z-10 bg-card p-[2px]">
                        <div className={`flex items-center justify-center w-full h-full rounded-full ${bgVariant}`}>
                          <Icon className={`h-4 w-4 ${iconColor}`} />
                        </div>
                      </div>
                      <div className="flex-1 p-4 rounded-xl border border-border bg-card shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                          <div className="flex items-center gap-3">
                            <StatusBadge status={badgeStatus as any} label={event.type.replace("_", " ")} />
                            {event.isManual && (
                              <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                                Manual Email
                              </span>
                            )}
                          </div>
                          
                          <div className="flex items-center">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="text-xs font-medium text-muted-foreground whitespace-nowrap cursor-help">
                                    {event.type === "SCHEDULED_EMAIL" ? "Scheduled for " : ""}
                                    {formatDistanceToNow(new Date(event.createdAt), { addSuffix: true })}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{format(new Date(event.createdAt), "MMM d, yyyy h:mm a")}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <span className="hidden sm:inline-block text-xs text-muted-foreground/40 mx-2">•</span>
                            <span className="hidden sm:inline-block text-xs font-medium text-muted-foreground whitespace-nowrap">
                              {format(new Date(event.createdAt), "MMM d, yyyy h:mm a")}
                            </span>
                          </div>
                        </div>

                        {event.type.includes("EMAIL") ? (
                          <div className="mt-2 space-y-2">
                            <h4 className="text-sm font-semibold text-foreground">{event.description}</h4>
                            {event.bodyPreview && (
                              <div className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg border border-border/50 line-clamp-3 whitespace-pre-wrap font-mono text-[13px]">
                                {event.bodyPreview}
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-sm text-foreground mt-2 font-medium">{event.description}</p>
                        )}
                      </div>
                    </div>
                  );
                })})()}
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
                <Link prefetch={true} href={`/prospects/${prospect.id}/sequence`}>
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
