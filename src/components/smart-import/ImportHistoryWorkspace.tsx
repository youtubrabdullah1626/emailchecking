"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useImport } from "@/components/providers/ImportProvider";
import { StorageEngine, ImportSessionMetadata } from "@/lib/storage/StorageEngine";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { History, Play, Trash2, CheckCircle2, Clock, AlertTriangle, Eye, Plus, MoreVertical, Edit2, Info, Users, Calendar, FileText } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDistanceToNow } from "date-fns";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

export function ImportHistoryWorkspace() {
  const [sessions, setSessions] = useState<ImportSessionMetadata[]>([]);
  const { sessionId, handleFileUpload, setAppendTargetSessionId } = useImport() as any;
  const storage = useMemo(() => new StorageEngine(), []);

  const loadSessions = useCallback(async () => {
    let all = storage.getAllSessions();
    
    // Auto-update COMPLETED status for LIVE CAMPAIGNS that have no pending items
    for (const session of all) {
      if (session.lastCheckpoint === "EXECUTION_STARTED") {
         try {
            const dataset = await storage.loadHeavyDataset(session.sessionId);
            const q = dataset?.executionQueue || [];
            if (q.length > 0) {
               const hasPending = q.some((item: any) => !item.liveStatus || item.liveStatus === "SCHEDULED" || item.liveStatus === "PROCESSING");
               if (!hasPending) {
                  session.status = "COMPLETED";
                  session.lastCheckpoint = "COMPLETED" as any;
                  storage.saveSessionMetadata(session);
               }
            }
         } catch (e) {
           console.error("Failed to load queue for completion check", e);
         }
      }
    }
    
    // Sort newest first
    all.sort((a, b) => new Date(b.importDate).getTime() - new Date(a.importDate).getTime());
    setSessions([...all]);
  }, [storage]);

  useEffect(() => {
    loadSessions();
    const interval = setInterval(loadSessions, 2000);
    return () => clearInterval(interval);
  }, [sessionId, loadSessions]);

  // Track hidden sessions (optimistic delete) and timers
  const [hiddenSessions, setHiddenSessions] = useState<Set<string>>(new Set());
  const deleteTimers = React.useRef<Record<string, NodeJS.Timeout>>({});
  
  // Track which session is currently queued for confirmation in the AlertDialog
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [prospectAction, setProspectAction] = useState<"CANCEL" | "DELETE">("CANCEL");

  // Removed unmount timer clearing so optimistic deletes actually execute even if user navigates away
  useEffect(() => {
    return () => {
      // Do not clearTimeout here, otherwise navigating away cancels the deletion
    };
  }, []);

  const handleResume = (id: string) => {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem("smart_import_active_session_id", id);
    }
    window.location.reload();
  };

  const executeDelete = async (id: string, action: "CANCEL" | "DELETE") => {
    try {
      const dataset = await storage.loadHeavyDataset(id);
      if (dataset && dataset.validatedRecords && dataset.validatedRecords.length > 0) {
        const emails = dataset.validatedRecords.map((r: any) => r.email).filter(Boolean);
        if (emails.length > 0) {
          await fetch("/api/prospects/bulk-action", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ emails, action }),
          });
        }
      }
    } catch (err) {
      console.error("Failed to perform prospect action", err);
    }

    await storage.deleteSession(id);
    setHiddenSessions(prev => {
      const next = new Set(prev);
      // Keep it hidden even after deletion to prevent flicker
      return next;
    });
    loadSessions();
  };

  const handleDeleteInitiated = async (id: string, action: "CANCEL" | "DELETE") => {
    // 1. Close the AlertDialog
    setSessionToDelete(null);

    // 2. Optimistic hide
    setHiddenSessions(prev => new Set(prev).add(id));

    // 3. Delete immediately without a fragile 6-second timeout
    await executeDelete(id, action);

    // 4. Show the sleek toast
    toast.success("Campaign deleted", {
      description: "Scheduled emails have been permanently deleted.",
    });
  };

  const handleRename = (id: string, currentName: string) => {
    const newName = window.prompt("Enter new campaign name:", currentName || "Draft Campaign");
    if (newName && newName.trim() !== "") {
      const allSessions = storage.getAllSessions();
      const session = allSessions.find(s => s.sessionId === id);
      if (session) {
        session.campaignName = newName.trim();
        storage.saveSessionMetadata(session);
        loadSessions(); // Refresh list
        toast.success("Campaign renamed successfully");
      }
    }
  };

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [targetAppendId, setTargetAppendId] = useState<string | null>(null);

  const handleAppendClick = (id: string) => {
    setTargetAppendId(id);
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const onFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && targetAppendId) {
      // Set the target session ID in context
      if (typeof window !== "undefined") {
         window.scrollTo({ top: 0, behavior: "smooth" });
      }
      if (setAppendTargetSessionId) {
        setAppendTargetSessionId(targetAppendId);
      }
      await handleFileUpload(file);
    }
    // reset
    if (e.target) e.target.value = '';
    setTargetAppendId(null);
  };

  if (sessions.length === 0) return null;

  const handleActionClick = async (session: ImportSessionMetadata) => {
    if (session.status === "COMPLETED" || session.lastCheckpoint === "EXECUTION_STARTED") {
       try {
         const dataset = await storage.loadHeavyDataset(session.sessionId);
         const campaignId = dataset?.campaignId;
         if (campaignId) {
            window.location.href = `/prospects?source=smart_import`;
            return;
         }
       } catch (e) {
         console.error("Failed to load campaignId", e);
       }
       // Fallback for old sessions that didn't have campaignId saved
       window.location.href = `/prospects`;
    } else {
       handleResume(session.sessionId);
    }
  };

  return (
    <Card className="border-border shadow-sm mb-8 animate-in fade-in slide-in-from-top-4 duration-500 overflow-hidden">
      <input type="file" ref={fileInputRef} className="hidden" accept=".csv,.xlsx" onChange={onFileSelected} />
      <CardHeader className="bg-muted/5 border-b border-border py-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            Full History
            <TooltipProvider>
              <Tooltip delayDuration={200}>
                <TooltipTrigger asChild>
                  <button type="button" className="flex items-center justify-center h-6 w-6 rounded-full bg-muted/50 text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors focus:outline-none cursor-help">
                    <Info className="h-3.5 w-3.5" strokeWidth={2.5} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" align="center" className="max-w-[280px] p-4 bg-white border border-slate-200 shadow-xl rounded-xl z-50">
                  <p className="font-semibold text-slate-900 mb-2">
                    What is Full History?
                  </p>
                  <div className="text-slate-600 text-xs leading-relaxed space-y-2">
                    <p>This shows all your past imports and active workflows.</p>
                    <p>You can instantly resume paused imports or monitor live campaigns from here! ⚡</p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardTitle>
          <Badge variant="outline">{sessions.length} Sessions</Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          {sessions.filter(s => !hiddenSessions.has(s.sessionId)).map(session => (
            <div key={session.sessionId} className="p-4 flex flex-col sm:flex-row sm:items-center gap-4 justify-between hover:bg-muted/10 transition-colors">
              <div className="space-y-2 flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-semibold truncate max-w-full">{session.campaignName || "Untitled Campaign"}</span>
                  <Badge variant={
                    session.status === "COMPLETED" ? "default" :
                    session.status === "FAILED" ? "destructive" :
                    session.lastCheckpoint === "EXECUTION_STARTED" ? "default" :
                    "secondary"
                  } className={
                    session.status === "COMPLETED" ? "bg-blue-500 hover:bg-blue-600 text-[10px] flex items-center gap-1 shrink-0" :
                    session.lastCheckpoint === "EXECUTION_STARTED" ? "bg-emerald-500 hover:bg-emerald-600 text-[10px] flex items-center gap-1 shrink-0" : 
                    "text-[10px] shrink-0"
                  }>
                    {session.status === "COMPLETED" && <CheckCircle2 className="h-3 w-3" />}
                    {session.lastCheckpoint === "EXECUTION_STARTED" && <Play className="h-3 w-3 fill-current" />}
                    {session.status === "COMPLETED" ? "COMPLETED" : session.lastCheckpoint === "EXECUTION_STARTED" ? "LIVE CAMPAIGN" : session.status}
                  </Badge>
                  {session.status === "DRAFT" && session.lastCheckpoint !== "EXECUTION_STARTED" && (
                    <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-200 bg-amber-50 shrink-0">
                      Checkpoint: {session.lastCheckpoint}
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground mt-1">
                  <span className="flex items-center gap-1.5 whitespace-nowrap">
                    <Users className="h-3.5 w-3.5 shrink-0 opacity-70" />
                    <span className="font-medium text-foreground/80">{session.totalRecords.toLocaleString()}</span> {session.totalRecords === 1 ? 'Lead' : 'Leads'}
                  </span>
                  
                  {session.estimatedCompletion && session.status !== "COMPLETED" && (
                    <span className="flex items-center gap-1.5 text-primary whitespace-nowrap bg-primary/5 px-2 py-0.5 rounded-full">
                      <Clock className="h-3.5 w-3.5 shrink-0" />
                      Ends {session.estimatedCompletion}
                    </span>
                  )}
                  
                  <span className="flex items-center gap-1.5 whitespace-nowrap">
                    <Calendar className="h-3.5 w-3.5 shrink-0 opacity-70" />
                    {formatDistanceToNow(new Date(session.importDate), { addSuffix: true })}
                  </span>
                  
                  <span className="flex items-center gap-1.5 max-w-[180px] sm:max-w-[220px] md:max-w-[300px]" title={session.fileName}>
                    <FileText className="h-3.5 w-3.5 shrink-0 opacity-70" />
                    <span className="truncate">{session.fileName}</span>
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {session.lastCheckpoint === "EXECUTION_STARTED" && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleAppendClick(session.sessionId)} 
                    className="gap-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200 shadow-sm transition-all hover:pr-4"
                  >
                    <Plus className="h-4 w-4" /> 
                    <span className="hidden sm:inline-block">Add Leads</span>
                  </Button>
                )}
                <Button 
                  variant={session.sessionId === sessionId ? "default" : "secondary"} 
                  size="sm" 
                  onClick={() => handleActionClick(session)} 
                  className={session.sessionId === sessionId 
                    ? "gap-2 shadow-sm"
                    : "gap-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-100 shadow-sm"
                  }
                >
                  <Eye className="h-4 w-4" /> {session.status === "COMPLETED" || session.lastCheckpoint === "EXECUTION_STARTED" ? "View Prospects" : (session.sessionId === sessionId ? "Currently Viewing" : "View Details")}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem onClick={() => handleRename(session.sessionId, session.campaignName || "Draft Campaign")}>
                      <Edit2 className="h-4 w-4 mr-2" />
                      Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSessionToDelete(session.sessionId)} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      </CardContent>

      <AlertDialog open={!!sessionToDelete} onOpenChange={(open) => {
        if (!open) {
          setSessionToDelete(null);
          setProspectAction("CANCEL"); // Reset action on close
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Campaign?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this campaign? <strong>All emails scheduled in this campaign will also be deleted.</strong>
            </AlertDialogDescription>
            <div className="mt-4 bg-muted/30 p-4 rounded-md border border-border">
              <h4 className="text-sm font-medium mb-3 text-foreground">What should happen to the prospects in your CRM?</h4>
              <RadioGroup value={prospectAction} onValueChange={(val: any) => setProspectAction(val)} className="space-y-3">
                <div className="flex items-start space-x-3">
                  <RadioGroupItem value="CANCEL" id="cancel" className="mt-1" />
                  <div className="grid gap-1.5">
                    <Label htmlFor="cancel" className="text-sm font-medium">Mark as &quot;User Cancelled&quot;</Label>
                    <p className="text-xs text-muted-foreground">Prospects stay in CRM but show a &quot;User Cancelled&quot; status.</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <RadioGroupItem value="DELETE" id="delete" className="mt-1" />
                  <div className="grid gap-1.5">
                    <Label htmlFor="delete" className="text-sm font-medium text-destructive">Completely wipe from CRM</Label>
                    <p className="text-xs text-muted-foreground">Permanently delete these prospects from your database entirely.</p>
                  </div>
                </div>
              </RadioGroup>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => sessionToDelete && handleDeleteInitiated(sessionToDelete, prospectAction)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete Campaign
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
