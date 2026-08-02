"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useImport } from "@/components/providers/ImportProvider";
import { StorageEngine, ImportSessionMetadata } from "@/lib/storage/StorageEngine";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { History, Play, Trash2, CheckCircle2, Clock, AlertTriangle, Eye, Plus, MoreVertical, Edit2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

export function ImportHistoryWorkspace() {
  const [sessions, setSessions] = useState<ImportSessionMetadata[]>([]);
  const { sessionId, handleFileUpload, setAppendTargetSessionId } = useImport() as any;
  const storage = useMemo(() => new StorageEngine(), []);

  const loadSessions = useCallback(() => {
    const all = storage.getAllSessions();
    // Sort newest first
    all.sort((a, b) => new Date(b.importDate).getTime() - new Date(a.importDate).getTime());
    setSessions(all);
  }, [storage]);

  useEffect(() => {
    loadSessions();
  }, [sessionId, loadSessions]); // Reload when current session changes

  const handleResume = (id: string) => {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem("smart_import_active_session_id", id);
    }
    window.location.reload();
  };

  const handleDelete = async (id: string) => {
    await storage.deleteSession(id);
    loadSessions();
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

  return (
    <Card className="border-border shadow-sm animate-in fade-in slide-in-from-bottom-4">
      <input type="file" ref={fileInputRef} className="hidden" accept=".csv,.xlsx" onChange={onFileSelected} />
      <CardHeader className="bg-muted/5 border-b border-border py-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <History className="h-5 w-5 text-muted-foreground" />
            Import History & Recovery
          </CardTitle>
          <Badge variant="outline">{sessions.length} Sessions</Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          {sessions.map(session => (
            <div key={session.sessionId} className="p-4 flex items-center justify-between hover:bg-muted/10 transition-colors">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <span className="font-semibold">{session.campaignName || "Untitled Campaign"}</span>
                  <Badge variant={
                    session.status === "COMPLETED" ? "default" :
                    session.status === "FAILED" ? "destructive" :
                    session.lastCheckpoint === "EXECUTION_STARTED" ? "default" :
                    "secondary"
                  } className={session.lastCheckpoint === "EXECUTION_STARTED" ? "bg-emerald-500 hover:bg-emerald-600 text-[10px]" : "text-[10px]"}>
                    {session.lastCheckpoint === "EXECUTION_STARTED" ? "LIVE CAMPAIGN" : session.status}
                  </Badge>
                  {session.status === "DRAFT" && session.lastCheckpoint !== "EXECUTION_STARTED" && (
                    <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-200 bg-amber-50">
                      Checkpoint: {session.lastCheckpoint}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    {session.totalRecords.toLocaleString()} Records
                  </span>
                  {session.estimatedCompletion && (
                    <span className="flex items-center gap-1 text-primary">
                      <Clock className="h-3 w-3" />
                      Finishes: {session.estimatedCompletion}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {session.lastCheckpoint === "EXECUTION_STARTED" ? "Started " : "Draft created "}
                    {formatDistanceToNow(new Date(session.importDate))} ago
                  </span>
                  <span className="flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {session.fileName}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
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
                {session.sessionId !== sessionId && (
                  <Button variant="secondary" size="sm" onClick={() => handleResume(session.sessionId)} className="gap-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-100 shadow-sm">
                    <Eye className="h-4 w-4" /> View Details
                  </Button>
                )}
                {session.sessionId === sessionId && (
                  <Button variant="secondary" size="sm" disabled className="gap-2">
                    Active Session
                  </Button>
                )}
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
                    <DropdownMenuItem onClick={() => handleDelete(session.sessionId)} className="text-destructive focus:text-destructive focus:bg-destructive/10">
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
    </Card>
  );
}
