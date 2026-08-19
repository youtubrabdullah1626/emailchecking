"use client";

import React, { useState, useCallback, useTransition, useMemo } from "react";
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

  // Determine chronological state between latest sent email and latest reply
  const sortedActivity = useMemo(() => {
    return [...activity].sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [activity]);

  const latestCommunication = sortedActivity.find((a: any) => a.type === "REPLY" || a.type === "EMAIL_SENT");
  const isReplied = latestCommunication ? latestCommunication.type === "REPLY" : prospect.status === "REPLIED";
  const hasSentAnyEmail = activity.some((a: any) => a.type === "EMAIL_SENT") || (prospect as any).isContacted || prospect.status === "COMPLETED";
  const isSent = hasSentAnyEmail && !isReplied && (!sequence || sequence.status !== "ACTIVE");
  const isActive = Boolean(sequence && sequence.status === "ACTIVE" && !isReplied);

  return (
    <div className="min-h-screen bg-slate-100/70 dark:bg-slate-950 p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <Link prefetch={true} href="/prospects" className="hover:text-foreground flex items-center gap-1">
          <ArrowLeft className="h-3 w-3" /> Back to prospects
        </Link>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="h-28 bg-gradient-to-r from-orange-500/15 via-amber-500/10 to-transparent relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-12 -mt-12 w-64 h-64 bg-gradient-to-br from-orange-500/10 to-transparent rounded-full blur-xl pointer-events-none" />
        </div>
        <div className="px-6 sm:px-8 pb-7 relative">
          <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-4">
            <Avatar className="h-22 w-22 border-4 border-white dark:border-slate-900 bg-white dark:bg-slate-900 -mt-11 shadow-md">
              <AvatarFallback className="bg-gradient-to-br from-orange-500 to-amber-500 text-white text-2xl font-black">
                {prospect.name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-wrap gap-2.5 items-center">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-700 border border-rose-200/60 dark:border-rose-900/60 rounded-xl text-xs font-semibold h-9 px-3">
                    Reset Prospect
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-2xl border border-slate-200 dark:border-slate-800">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete all sent emails, sequence enrollments, and activity history for <strong>{prospect.name}</strong>. They will look like a brand new prospect. This action cannot be reversed.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                      className="bg-rose-600 text-white hover:bg-rose-700 font-bold rounded-xl"
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
              <Button variant="outline" size="sm" className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-xs h-9 px-3.5" asChild>
                <Link prefetch={true} href={`/prospects/${prospect.id}/edit`}>Edit</Link>
              </Button>
              
              <Button 
                variant="outline"
                size="sm" 
                className="gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 font-semibold text-xs h-9 px-3.5"
                onClick={() => setIsComposerOpen(true)}
              >
                <Mail className="h-3.5 w-3.5 text-slate-500" />
                Send Email
              </Button>

              <Button 
                size="sm" 
                className="gap-2 min-w-[140px] rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold shadow-md shadow-orange-500/20 text-xs h-9 px-4 transition-all duration-200" 
                disabled={isPending}
                onClick={() => {
                  startTransition(() => router.push(`/prospects/${prospect.id}/sequence`));
                }}
              >
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  sequence ? <Play className="h-3.5 w-3.5 fill-current" /> : <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
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
          
          <div className="mt-5">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">{prospect.name}</h1>
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
            
            <div className="flex flex-wrap gap-4 mt-3 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-1.5">
                <Building className="h-4 w-4 text-slate-400" />
                <span className="font-medium text-slate-700 dark:text-slate-300">{prospect.company || "Unknown Company"}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Mail className="h-4 w-4 text-slate-400" />
                <a href={`mailto:${prospect.email}`} className="hover:underline text-slate-700 dark:text-slate-300 font-medium">
                  {prospect.email}
                </a>
              </div>
              <div className="flex items-center gap-1.5">
                <Globe className="h-4 w-4 text-slate-400" />
                <span>{prospect.timezone || "UTC"}</span>
              </div>
              <div className="flex items-center gap-1.5" suppressHydrationWarning>
                <Clock className="h-4 w-4 text-slate-400" />
                Added {formatDistanceToNow(new Date(prospect.created_at), { addSuffix: true })}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="activity" className="w-full">
        <TabsList className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 h-12 w-full justify-start rounded-2xl p-1 shadow-xs gap-1">
          <TabsTrigger value="activity" className="rounded-xl px-4 text-xs font-bold data-[state=active]:bg-slate-900 data-[state=active]:text-white dark:data-[state=active]:bg-white dark:data-[state=active]:text-slate-900 transition-all">Activity</TabsTrigger>
          <TabsTrigger value="sequence" className="rounded-xl px-4 text-xs font-bold data-[state=active]:bg-slate-900 data-[state=active]:text-white dark:data-[state=active]:bg-white dark:data-[state=active]:text-slate-900 transition-all">Sequence</TabsTrigger>
          <TabsTrigger value="profile" className="rounded-xl px-4 text-xs font-bold data-[state=active]:bg-slate-900 data-[state=active]:text-white dark:data-[state=active]:bg-white dark:data-[state=active]:text-slate-900 transition-all">Profile Details</TabsTrigger>
        </TabsList>
        
        <TabsContent value="activity" className="mt-6">
          {/* Unified Executive Activity Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
            {/* Integrated Card Header */}
            <div className="p-4 sm:px-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/40 dark:bg-slate-900/40">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0 border border-orange-500/20">
                  <Clock className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Activity & Outreach History
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Chronological history of sent emails, replies, and sequence touches
                  </p>
                </div>
              </div>

              <Badge variant="outline" className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-2xs">
                {activity.length} {activity.length === 1 ? "Event" : "Events"}
              </Badge>
            </div>

            {/* Seamless List Items */}
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {isActivityLoading ? (
                <div className="p-10 text-center text-xs text-slate-400 animate-pulse">Loading activity history...</div>
              ) : activityError ? (
                <div className="p-10 text-center text-xs text-red-500">Failed to load activity timeline.</div>
              ) : (() => {
                const filteredActivity = activity.filter((e: any) => 
                  ["EMAIL_SENT", "SCHEDULED_EMAIL", "REPLY", "FAILED", "SEQUENCE_STARTED", "ADDED"].includes(e.type)
                );
                
                if (filteredActivity.length === 0) {
                  return (
                    <div className="p-12 text-center text-xs text-slate-400">
                      No emails or outreach activity recorded yet for this prospect.
                    </div>
                  );
                }

                return filteredActivity.map((event: any) => {
                  const isReply = event.type === "REPLY";
                  const isEmail = event.type === "EMAIL_SENT";
                  const isScheduled = event.type === "SCHEDULED_EMAIL";
                  const isSequence = event.type === "SEQUENCE_STARTED";

                  return (
                    <div
                      key={event.id}
                      className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Left: Avatar + Details */}
                      <div className="flex items-center gap-3.5 min-w-0 flex-1">
                        <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 border shadow-2xs ${
                          isReply ? "bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 border-indigo-200/70" :
                          isEmail ? "bg-blue-50 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 border-blue-200/70" :
                          isScheduled ? "bg-purple-50 dark:bg-purple-950/70 text-purple-600 dark:text-purple-400 border-purple-200/70" :
                          isSequence ? "bg-emerald-50 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 border-emerald-200/70" :
                          "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200/70"
                        }`}>
                          {isReply ? <MessageSquare className="h-4 w-4" /> :
                           isEmail ? <Mail className="h-4 w-4" /> :
                           isScheduled ? <Clock className="h-4 w-4" /> :
                           isSequence ? <Play className="h-4 w-4 fill-current" /> :
                           <Check className="h-4 w-4" />}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
                              {event.title || event.description}
                            </span>
                            <Badge variant="outline" className={`text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${
                              isReply ? "bg-indigo-50 text-indigo-700 border-indigo-200/80 font-bold" :
                              isEmail ? "bg-blue-50 text-blue-700 border-blue-200/80" :
                              isScheduled ? "bg-purple-50 text-purple-700 border-purple-200/80" :
                              isSequence ? "bg-emerald-50 text-emerald-700 border-emerald-200/80" :
                              "bg-slate-100 text-slate-600 border-slate-200/80"
                            }`}>
                              {isReply ? "REPLY" : isEmail ? (event.isManual ? "Manual Email" : "Outreach Email") : isScheduled ? "Scheduled" : isSequence ? "Sequence" : "Created"}
                            </Badge>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-2 text-xs text-slate-400 mt-1 truncate">
                            <span suppressHydrationWarning className="font-medium text-slate-500 dark:text-slate-400">
                              {formatDistanceToNow(new Date(event.createdAt), { addSuffix: true })}
                            </span>
                            <span className="text-slate-300 dark:text-slate-600">•</span>
                            <span className="truncate max-w-lg text-slate-500 dark:text-slate-400 italic">
                              {event.bodyPreview ? `"${event.bodyPreview.replace(/\n/g, " ").trim()}"` : event.description}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Clean Date Format */}
                      <div className="text-xs font-medium text-slate-400 dark:text-slate-500 shrink-0 self-start sm:self-center" suppressHydrationWarning>
                        {format(new Date(event.createdAt), "MMM d, yyyy • h:mm a")}
                      </div>
                    </div>
                  );
                })
              })()}
            </div>
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
    </div>
  );
}

export default React.memo(ProspectDetailClientComponent);
