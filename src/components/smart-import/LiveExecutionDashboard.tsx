"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useImport } from "@/components/providers/ImportProvider";
import { ExecutionQueueItem } from "@/lib/scheduler/SchedulingTypes";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Send, MailOpen, Reply, AlertCircle, Clock, Activity, Calendar as CalendarIcon, User, MoreHorizontal, Play, Loader2, ArrowLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO, differenceInDays } from "date-fns";

type LiveItem = ExecutionQueueItem & {
  liveStatus: "SCHEDULED" | "SENT" | "OPENED" | "REPLIED" | "BOUNCED";
  lastEventTime: string;
};

export function LiveExecutionDashboard() {
  const { getExecutionQueue, updateQueueItemState, closeSession, deleteQueueItem, rescheduleQueueItem } = useImport() as any;
  const [liveItems, setLiveItems] = useState<LiveItem[]>([]);
  
  // Real stats based on actual data
  const stats = useMemo(() => {
    let sent = 0, opened = 0, replied = 0, bounced = 0;
    liveItems.forEach(item => {
      // Funnel metrics: If it was opened or replied, it was definitely sent.
      if (["SENT", "OPENED", "REPLIED"].includes(item.liveStatus as string)) sent++;
      
      // If it was replied to, it was definitely opened.
      if (["OPENED", "REPLIED"].includes(item.liveStatus as string)) opened++;
      
      if (item.liveStatus === "REPLIED") replied++;
      if (item.liveStatus === "BOUNCED") bounced++;
    });
    return { sent, opened, replied, bounced };
  }, [liveItems]);

  // Lead Journey Sheet State
  const [selectedLead, setSelectedLead] = useState<string | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  // Reschedule Dialog State
  const [rescheduleItem, setRescheduleItem] = useState<LiveItem | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
// Helper to actually send the email via the backend
  const sendEmailViaBackend = async (item: LiveItem): Promise<boolean> => {
    try {
      const res = await fetch("/api/gmail/send-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: item.recipientEmail,
          toName: "",
          subject: `Outreach to ${item.recipientEmail}`,
          content: item.sequenceStep.content
        })
      });
      const data = await res.json();
      if (!res.ok) {
        console.error("Failed to send email:", data.error);
        if (data.error && data.error.includes("OAuth not configured")) {
           toast.error("Gmail OAuth Missing", { description: "Please configure your .env.local file with Gmail API credentials." });
        } else {
           toast.error("Delivery Failed", { description: data.error || "Unknown API error" });
        }
        return false;
      }
      return true;
    } catch (e: any) {
      console.error("Network error sending email", e);
      toast.error("Network Error", { description: e.message || "Failed to reach backend." });
      return false;
    }
  };

  // Initialize Queue with honest data - run ONLY once on mount to prevent reset loops
  const initialized = React.useRef(false);
  useEffect(() => {
    if (!initialized.current) {
      const q = getExecutionQueue();
      if (q && q.length > 0) {
        setLiveItems(
          q.map((item: ExecutionQueueItem) => ({
            ...item,
            liveStatus: item.liveStatus || "SCHEDULED",
            lastEventTime: item.lastEventTime || "-",
          }))
        );
        initialized.current = true;
      }
    }
  }, [getExecutionQueue]);

  // Keep a ref to the latest items for the interval to read without stale closures
  const liveItemsRef = React.useRef(liveItems);
  useEffect(() => {
    liveItemsRef.current = liveItems;
  }, [liveItems]);

  // Check for Replies Worker (Every 15s)
  useEffect(() => {
    const checkLiveTrackingStatus = async () => {
      const currentItems = liveItemsRef.current;
      // Check items that are SENT or OPENED (since they could transition to OPENED, REPLIED)
      const activeItems = currentItems.filter(
        item => item.liveStatus === "SENT" || item.liveStatus === "OPENED"
      );

      if (activeItems.length === 0) return;
      const stepIds = activeItems.map(item => item.queueId);

      try {
        const res = await fetch("/api/track/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stepIds })
        });
        const data = await res.json();
        
        if (data.statuses && data.statuses.length > 0) {
          const newTimeStr = new Date().toLocaleTimeString([], { hour12: false });
          
          setLiveItems(prev => prev.map(item => {
            const tracking = data.statuses.find((s: any) => s.stepId === item.queueId);
            if (tracking && tracking.status && tracking.status !== item.liveStatus) {
              
              if (updateQueueItemState) {
                updateQueueItemState(item.queueId, tracking.status, newTimeStr);
              }

              if (tracking.status === "REPLIED") {
                toast.success("New Reply Detected!", {
                  description: `${item.recipientEmail} has replied.`,
                  icon: <Reply className="h-4 w-4 text-emerald-500" />
                });
              } else if (tracking.status === "OPENED" && item.liveStatus === "SENT") {
                toast.success("Email Opened!", {
                  description: `${item.recipientEmail} just opened your email.`,
                  icon: <MailOpen className="h-4 w-4 text-blue-500" />
                });
              }

              return { ...item, liveStatus: tracking.status, lastEventTime: newTimeStr };
            }
            return item;
          }));
        }
      } catch (err) {
        console.error("Failed to check tracking status", err);
      }
    };

    // Initial check
    checkLiveTrackingStatus();
    // Poll every 15 seconds
    const interval = setInterval(checkLiveTrackingStatus, 15000);
    return () => clearInterval(interval);
  }, [updateQueueItemState]);

  // Dispatch Worker (Simulates Backend Queue Processor)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const currentItems = liveItemsRef.current;
      
      currentItems.forEach(item => {
        if (item.liveStatus === "SCHEDULED") {
          // Helper to get current time in target timezone
          const targetTimezone = item.timezone || "UTC"; // fallback
          let tzNowStr = "";
          try {
            const tzOptions = { timeZone: targetTimezone, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' } as const;
            const parts = new Intl.DateTimeFormat('en-US', tzOptions).formatToParts(now);
            const p = (type: string) => parts.find(p => p.type === type)?.value || "";
            let h = parseInt(p('hour'), 10);
            if (h === 24) h = 0;
            tzNowStr = `${p('year')}-${p('month')}-${p('day')}T${h.toString().padStart(2, '0')}:${p('minute')}:${p('second')}`;
          } catch (e) {
            // fallback to local time if timezone is invalid
            tzNowStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
          }
          
          const itemScheduledStr = `${item.scheduledDate}T${item.scheduledTime}:00`;
          
          if (tzNowStr >= itemScheduledStr) {
            // 1. Immediately mark as PROCESSING in state to prevent next tick from picking it up
            setLiveItems(prev => prev.map(i => 
              i.queueId === item.queueId ? { ...i, liveStatus: "PROCESSING" as any } : i
            ));

            // 2. Fire the side-effect EXACTLY ONCE (outside of setState to avoid Strict Mode double-invocation)
            sendEmailViaBackend(item).then(success => {
              const statusStr = success ? "SENT" : "BOUNCED";
              const timeStr = new Date().toLocaleTimeString([], { hour12: false });

              setLiveItems(prev => prev.map(ci => {
                if (ci.queueId === item.queueId) {
                  if (success) {
                    toast.success("Email Sent Automatically", { description: `Delivered to ${ci.recipientEmail}` });
                  }
                  return { ...ci, liveStatus: statusStr, lastEventTime: timeStr };
                }
                return ci;
              }));

              // Persist to indexedDB so it survives page reloads
              if (updateQueueItemState) {
                updateQueueItemState(item.queueId, statusStr, timeStr);
              }
            });
          }
        }
      });
    }, 1000); 

    return () => clearInterval(interval);
  }, [updateQueueItemState]);

  // Lead Journey items
  const selectedLeadItems = useMemo(() => {
    if (!selectedLead) return [];
    return liveItems
      .filter(i => i.recipientEmail === selectedLead)
      .sort((a, b) => a.priority - b.priority);
  }, [selectedLead, liveItems]);

  const openLeadJourney = (email: string) => {
    setSelectedLead(email);
    setIsSheetOpen(true);
  };

  const handleSendNow = async (e: React.MouseEvent, queueId: string) => {
    e.stopPropagation();
    
    // Find the item
    const targetItem = liveItems.find(i => i.queueId === queueId);
    if (!targetItem) return;

    // Optimistically mark as sending/sent
    setLiveItems(prev => prev.map(item => {
      if (item.queueId === queueId) {
        return { ...item, liveStatus: "SENT", lastEventTime: "Sending..." };
      }
      return item;
    }));

    toast.loading("Sending email...", { id: queueId });

    const success = await sendEmailViaBackend(targetItem);
    const statusStr = success ? "SENT" : "SCHEDULED";
    const timeStr = success ? new Date().toLocaleTimeString([], { hour12: false }) : "-";
    
    setLiveItems(prev => prev.map(item => {
      if (item.queueId === queueId) {
        if (success) {
          toast.success("Email Delivered!", { id: queueId, description: `Sent to ${item.recipientEmail}` });
        } else {
          toast.error("Failed to deliver", { id: queueId });
        }
        return {
          ...item,
          liveStatus: statusStr as any,
          lastEventTime: timeStr
        };
      }
      return item;
    }));

    if (success && updateQueueItemState) {
      updateQueueItemState(queueId, statusStr, timeStr);
    }
  };

  const openReschedule = (e: React.MouseEvent, item: LiveItem) => {
    e.stopPropagation();
    setRescheduleItem(item);
    setRescheduleDate(item.scheduledDate);
    setRescheduleTime(item.scheduledTime);
  };

  const handleSaveReschedule = () => {
    if (!rescheduleItem) return;
    setLiveItems(prev => prev.map(item => {
      if (item.queueId === rescheduleItem.queueId) {
        return {
          ...item,
          scheduledDate: rescheduleDate,
          scheduledTime: rescheduleTime,
        };
      }
      return item;
    }));
    if (rescheduleQueueItem) {
      rescheduleQueueItem(rescheduleItem.queueId, rescheduleDate, rescheduleTime);
    }
    toast.success("Email Rescheduled");
    setRescheduleItem(null);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "SCHEDULED": return <Badge variant="secondary" className="bg-muted text-muted-foreground font-normal"><Clock className="h-3 w-3 mr-1" /> Scheduled</Badge>;
      case "PROCESSING": return <Badge variant="secondary" className="bg-orange-50 text-orange-600 border-orange-200 font-normal"><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Processing</Badge>;
      case "SENT": return <Badge variant="secondary" className="bg-blue-50 text-blue-600 border-blue-200 font-normal"><Send className="h-3 w-3 mr-1" /> Sent</Badge>;
      case "OPENED": return <Badge variant="secondary" className="bg-purple-50 text-purple-600 border-purple-200 font-normal"><MailOpen className="h-3 w-3 mr-1" /> Opened</Badge>;
      case "REPLIED": return <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200 font-medium"><Reply className="h-3 w-3 mr-1" /> Replied</Badge>;
      case "BOUNCED": return <Badge variant="secondary" className="bg-red-50 text-red-600 border-red-200 font-normal"><AlertCircle className="h-3 w-3 mr-1" /> Failed</Badge>;
      default: return null;
    }
  };

  const handleDeleteItem = (e: React.MouseEvent, queueId: string) => {
    e.stopPropagation();
    setLiveItems(prev => prev.filter(i => i.queueId !== queueId));
    if (deleteQueueItem) deleteQueueItem(queueId);
    toast.success("Item removed from queue");
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => closeSession && closeSession()} 
            className="h-9 w-9 rounded-full bg-muted/30 hover:bg-muted shrink-0 text-muted-foreground hover:text-foreground transition-colors shadow-sm border border-transparent hover:border-border"
            title="Back to Import History"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Activity className="h-6 w-6 text-primary" />
              Live Campaign Execution
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Monitoring true campaign status and delivery metrics.
            </p>
          </div>
        </div>
        <Badge variant="default" className="bg-emerald-500 hover:bg-emerald-600 shadow-sm">
          🟢 ACTIVE
        </Badge>
      </div>

      {/* Progress & Stats */}
      <Card className="border-border shadow-sm overflow-hidden">
        <CardContent className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="space-y-1 border-r border-border/50 pr-4">
              <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Send className="h-4 w-4" /> Sent
              </p>
              <p className="text-3xl font-bold">{stats.sent}</p>
            </div>
            <div className="space-y-1 border-r border-border/50 pr-4">
              <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <MailOpen className="h-4 w-4 text-blue-500" /> Opened
              </p>
              <p className="text-3xl font-bold">{stats.opened}</p>
            </div>
            <div className="space-y-1 border-r border-border/50 pr-4">
              <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Reply className="h-4 w-4 text-emerald-500" /> Replied
              </p>
              <p className="text-3xl font-bold text-emerald-600">{stats.replied}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-500" /> Failed
              </p>
              <p className="text-3xl font-bold">{stats.bounced}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Table */}
      <Card className="border-border shadow-md flex flex-col overflow-hidden h-[600px] bg-background">
        <CardHeader className="bg-muted/10 border-b border-border py-4">
          <CardTitle className="text-base font-semibold flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Live Email Delivery Status
            </div>
            <span className="text-xs font-medium text-muted-foreground bg-background px-3 py-1.5 rounded-full border border-border shadow-sm">
              Click any row to view the lead&apos;s full journey
            </span>
          </CardTitle>
        </CardHeader>
        <ScrollArea className="flex-1">
          <Table>
            <TableHeader className="bg-muted/20 sticky top-0 z-10 shadow-sm backdrop-blur-md">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[30%] py-4 font-semibold">Recipient</TableHead>
                <TableHead className="w-[15%] py-4 font-semibold">Email Step</TableHead>
                <TableHead className="w-[20%] py-4 font-semibold">Scheduled Time</TableHead>
                <TableHead className="w-[15%] py-4 font-semibold">Live Status</TableHead>
                <TableHead className="w-[15%] py-4 font-semibold text-right">Event Time</TableHead>
                <TableHead className="w-[5%] py-4 text-center"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-border/50">
              {liveItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center h-40 text-muted-foreground flex flex-col items-center justify-center space-y-3">
                    <Activity className="h-10 w-10 text-muted-foreground/30" />
                    <span className="font-medium">No valid emails scheduled in this campaign.</span>
                  </TableCell>
                </TableRow>
              ) : (
                liveItems.map((item, idx) => (
                  <TableRow 
                    key={item.queueId + idx} 
                    onClick={() => openLeadJourney(item.recipientEmail)}
                    className={`hover:bg-muted/40 transition-all duration-200 cursor-pointer group relative ${
                      item.isNew ? 'bg-emerald-50/30' : ''
                    }`}
                  >
                    <TableCell className="font-medium py-3 relative">
                      {item.isNew && (
                        <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-emerald-500 rounded-r-md shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                      )}
                      <div className="flex items-center gap-3 pl-2">
                        <Avatar className={`h-8 w-8 ring-1 shadow-sm transition-all ${
                          item.isNew 
                            ? 'ring-emerald-200 bg-emerald-100/50' 
                            : 'ring-border group-hover:ring-primary/30'
                        }`}>
                           <AvatarFallback className={`text-xs font-semibold ${
                             item.isNew ? 'text-emerald-700 bg-emerald-100/50' : 'bg-primary/5 text-primary'
                           }`}>
                             {item.recipientEmail.substring(0, 2).toUpperCase()}
                           </AvatarFallback>
                        </Avatar>
                        <span className="truncate max-w-[220px]" title={item.recipientEmail}>
                          {item.recipientEmail}
                        </span>
                        {item.isNew && (
                          <Badge variant="outline" className="ml-2 bg-emerald-50 text-emerald-600 border-emerald-200 shadow-sm text-[10px] uppercase font-semibold px-2 py-0 h-5">
                            Just Added
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-3">
                      <Badge variant="outline" className="text-[10px] font-medium shadow-none bg-muted/20 text-muted-foreground group-hover:bg-background group-hover:text-foreground transition-colors">
                        Email {item.sequenceStep.stepNumber}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm font-mono py-3">
                      {item.scheduledDate} <span className="mx-1.5 text-border">•</span> {item.scheduledTime}
                    </TableCell>
                    <TableCell className="py-3">
                      {getStatusBadge(item.liveStatus)}
                    </TableCell>
                    <TableCell className="text-right text-xs font-mono text-muted-foreground py-3">
                      {item.lastEventTime}
                    </TableCell>
                    <TableCell className="text-center py-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                          <Button variant="ghost" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100 data-[state=open]:opacity-100">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 shadow-lg">
                          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Actions
                          </div>
                          <DropdownMenuItem 
                            onClick={(e) => handleSendNow(e, item.queueId)} 
                            disabled={item.liveStatus !== "SCHEDULED"}
                            className="cursor-pointer"
                          >
                            <Play className="h-4 w-4 mr-2 text-emerald-500" />
                            Send Now
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={(e) => openReschedule(e, item)} 
                            disabled={item.liveStatus !== "SCHEDULED"}
                            className="cursor-pointer"
                          >
                            <Clock className="h-4 w-4 mr-2 text-primary" /> Reschedule
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={(e) => handleDeleteItem(e, item.queueId)} 
                            className="cursor-pointer text-red-600 focus:text-red-700 focus:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4 mr-2" /> Delete Item
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </Card>

      {/* Reschedule Dialog */}
      <Dialog open={!!rescheduleItem} onOpenChange={(open) => !open && setRescheduleItem(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Reschedule Email</DialogTitle>
            <DialogDescription>
              Change the scheduled date and time for <span className="font-semibold text-foreground">{rescheduleItem?.recipientEmail}</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="date" className="text-right">
                Date
              </Label>
              <Input
                id="date"
                type="date"
                value={rescheduleDate}
                onChange={(e) => setRescheduleDate(e.target.value)}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="time" className="text-right">
                Time
              </Label>
              <Input
                id="time"
                type="time"
                value={rescheduleTime}
                onChange={(e) => setRescheduleTime(e.target.value)}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRescheduleItem(null)}>Cancel</Button>
            <Button onClick={handleSaveReschedule}>Save Schedule</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lead Journey Side Panel */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="w-[400px] sm:w-[540px] border-l border-border p-0 flex flex-col shadow-2xl">
          <SheetHeader className="p-6 border-b border-border bg-muted/10">
            <SheetTitle className="flex items-center gap-2 text-xl">
              <User className="h-5 w-5 text-primary" />
              Lead Journey
            </SheetTitle>
            <SheetDescription className="text-sm font-medium text-foreground mt-2 truncate">
              {selectedLead}
            </SheetDescription>
          </SheetHeader>
          
          <ScrollArea className="flex-1 p-6">
            <div className="space-y-8 relative pb-8">
              {/* Vertical connecting line for micro-timeline */}
              <div className="absolute left-6 top-4 bottom-8 w-px bg-border/60" />

              {selectedLeadItems.map((item, idx) => {
                const step = item.sequenceStep.stepNumber;
                let delayStr = "";
                
                if (idx === 0) {
                  delayStr = "Today";
                } else {
                  const firstDate = parseISO(selectedLeadItems[0].scheduledDate);
                  const thisDate = parseISO(item.scheduledDate);
                  const diff = Math.max(0, differenceInDays(thisDate, firstDate));
                  delayStr = diff > 0 ? `+${diff} Days` : "Same Day";
                }

                const exactDate = format(parseISO(item.scheduledDate), "MMM do");
                
                return (
                  <div key={item.queueId} className="relative pl-14">
                    {/* Step Marker */}
                    <div className="absolute left-[20px] top-1 h-2 w-2 rounded-full bg-primary ring-4 ring-background shadow-sm" />
                    
                    <div className="bg-background rounded-lg border border-border shadow-sm p-4 space-y-3">
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="bg-primary/5 border-primary/20 text-primary shadow-none">
                            {step === 1 ? "Initial Email" : `Follow-up ${step - 1}`}
                          </Badge>
                          <span className="text-xs font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                            {delayStr}
                          </span>
                        </div>
                        {getStatusBadge(item.liveStatus)}
                      </div>

                      <div className="bg-muted/30 rounded-md p-3 border border-border/50">
                        <div className="text-sm text-foreground/90 whitespace-pre-wrap font-sans">
                          {item.sequenceStep.content}
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/50">
                        <div className="flex items-center gap-1.5 font-medium">
                          <CalendarIcon className="h-3.5 w-3.5" />
                          {exactDate} <span className="mx-0.5">•</span> {item.scheduledTime}
                        </div>
                        {item.liveStatus !== "SCHEDULED" && (
                          <div className="flex items-center gap-1">
                            <Activity className="h-3 w-3" />
                            {item.liveStatus.toLowerCase()} at {item.lastEventTime}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {selectedLeadItems.length > 0 && (
                <div className="relative pl-14 pt-2">
                  <div className="absolute left-[20px] top-4 h-2 w-2 rounded-full bg-muted ring-4 ring-background border border-border" />
                  <span className="text-sm font-medium text-muted-foreground">Journey Ends</span>
                </div>
              )}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  );
}
