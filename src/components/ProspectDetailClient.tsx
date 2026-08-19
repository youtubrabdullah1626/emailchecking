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
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ProspectForm from "@/components/ProspectForm";
import { QuickEmailComposer } from "@/components/QuickEmailComposer";
import useSWR from "swr";
import { LegacyLoadingState as LoadingState, LegacyErrorState as ErrorState } from "@/components/ui/legacy-adapters";
import { Check, X, Play, MessageSquare, Send } from "lucide-react";

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

  const isReplied = prospect.status === "REPLIED" || activity.some((a: any) => a.type === "REPLY");
  const isSent = activity.some((a: any) => a.type === "EMAIL_SENT") || prospect.status === "COMPLETED";
  const isActive = Boolean(sequence && sequence.status === "ACTIVE" && !isReplied);

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
              {isReplied ? (
                <Badge className="bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200/60 text-xs font-bold gap-1 px-2.5 py-0.5">
                  <MessageSquare className="h-3 w-3" />
                  Replied
                </Badge>
              ) : isActive ? (
                <Badge className="bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200/60 text-xs font-bold gap-1 px-2.5 py-0.5">
                  <Play className="h-3 w-3 fill-current animate-pulse" />
                  Active Outreach
                </Badge>
              ) : isSent ? (
                <Badge className="bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200/60 text-xs font-bold gap-1 px-2.5 py-0.5">
                  <Send className="h-3 w-3" />
                  Sent
                </Badge>
              ) : (
                <Badge variant="outline" className="text-slate-500 border-slate-200 text-xs font-medium px-2.5 py-0.5">
                  Not Started
                </Badge>
              )}
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
              <div className="flex items-center gap-1.5" suppressHydrationWarning>
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
        
        <TabsContent value="activity" className="mt-6 space-y-4">
          {/* Header Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
                <Clock className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  Activity & Outreach History
                  <span className="text-[11px] font-medium text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                    {activity.length} {activity.length === 1 ? "event" : "events"}
                  </span>
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Chronological history of emails, replies, and campaign touches
                </p>
              </div>
            </div>
          </div>

          {/* Minimalist List Container (YouTube / Smart Import Style) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden divide-y divide-slate-100 dark:divide-slate-800/80">
            {isActivityLoading ? (
              <div className="p-8 text-center text-xs text-slate-400 animate-pulse">Loading timeline...</div>
            ) : activityError ? (
              <div className="p-8 text-center text-xs text-red-500">Failed to load activity timeline.</div>
            ) : (() => {
              const filteredActivity = activity.filter((e: any) => 
                ["EMAIL_SENT", "SCHEDULED_EMAIL", "REPLY", "FAILED", "SEQUENCE_STARTED", "ADDED"].includes(e.type)
              );
              
              if (filteredActivity.length === 0) {
                return (
                  <div className="p-10 text-center text-xs text-slate-400">
                    No outreach emails or activity recorded yet for this prospect.
                  </div>
                );
              }

              return filteredActivity.map((event: any) => {
                const isReply = event.type === "REPLY";
                const isEmail = event.type === "EMAIL_SENT";
                const isScheduled = event.type === "SCHEDULED_EMAIL";
                const isSequence = event.type === "SEQUENCE_STARTED";
                const isAdded = event.type === "ADDED";

                return (
                  <div
                    key={event.id}
                    className="p-3.5 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    {/* Left: Icon & Details */}
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 border ${
                        isReply ? "bg-indigo-50 text-indigo-600 border-indigo-200/60" :
                        isEmail ? "bg-blue-50 text-blue-600 border-blue-200/60" :
                        isScheduled ? "bg-purple-50 text-purple-600 border-purple-200/60" :
                        isSequence ? "bg-emerald-50 text-emerald-600 border-emerald-200/60" :
                        "bg-slate-100 text-slate-500 border-slate-200/60"
                      }`}>
                        {isReply ? <MessageSquare className="h-3.5 w-3.5" /> :
                         isEmail ? <Mail className="h-3.5 w-3.5" /> :
                         isScheduled ? <Clock className="h-3.5 w-3.5" /> :
                         isSequence ? <Play className="h-3.5 w-3.5 fill-current" /> :
                         <Check className="h-3.5 w-3.5" />}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                            {event.title || event.description}
                          </span>
                          <Badge variant="outline" className={`text-[9px] px-1.5 py-0 rounded-full font-bold shrink-0 ${
                            isReply ? "bg-indigo-50 text-indigo-700 border-indigo-200/60" :
                            isEmail ? "bg-blue-50 text-blue-700 border-blue-200/60" :
                            isScheduled ? "bg-purple-50 text-purple-700 border-purple-200/60" :
                            isSequence ? "bg-emerald-50 text-emerald-700 border-emerald-200/60" :
                            "bg-slate-100 text-slate-600 border-slate-200/60"
                          }`}>
                            {isReply ? "REPLY" : isEmail ? (event.isManual ? "MANUAL EMAIL" : "EMAIL SENT") : isScheduled ? "SCHEDULED" : isSequence ? "SEQUENCE" : "CREATED"}
                          </Badge>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-slate-400 mt-0.5 truncate">
                          <span suppressHydrationWarning>{formatDistanceToNow(new Date(event.createdAt), { addSuffix: true })}</span>
                          <span>•</span>
                          <span className="truncate max-w-md text-slate-500 dark:text-slate-400">
                            {event.bodyPreview ? `"${event.bodyPreview.replace(/\n/g, " ").trim()}"` : event.description}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Exact Timestamp */}
                    <div className="text-[11px] text-slate-400 shrink-0 self-end sm:self-center" suppressHydrationWarning>
                      {format(new Date(event.createdAt), "MMM d, yyyy, h:mm a")}
                    </div>
                  </div>
                );
              })
            })()}
          </div>
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
