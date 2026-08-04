"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { MockUser } from "../types";
import { BlockUserDialog } from "./BlockUserDialog";
import { UnblockUserDialog } from "./UnblockUserDialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Activity, Mail, CheckCircle2, UserCircle, LogIn
} from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";

interface UserProfileDrawerProps {
  user: MockUser | null;
  isOpen: boolean;
  onClose: () => void;
}

export function UserProfileDrawer({ user, isOpen, onClose }: UserProfileDrawerProps) {
  const [isBlockDialogOpen, setIsBlockDialogOpen] = useState(false);
  const [isUnblockDialogOpen, setIsUnblockDialogOpen] = useState(false);
  const router = useRouter();

  if (!user) return null;

  const isBlocked = user.status === "Suspended" || user.status === "Banned";

  const handleBlockAction = async (type: "temporary" | "permanent") => {
    try {
      await fetch(`/api/admin/users/${user.email}/block`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type })
      });
      router.refresh();
      setIsBlockDialogOpen(false);
    } catch (e) {
      console.error(e);
    }
  };

  const handleUnblock = async () => {
    try {
      await fetch(`/api/admin/users/${user.email}/unblock`, { method: 'POST' });
      router.refresh();
      setIsUnblockDialogOpen(false);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-3xl overflow-y-auto" side="right">
        <SheetHeader className="pb-6 border-b border-border">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16 border-2 border-background shadow-sm">
                <AvatarImage src={user.avatarUrl} alt={user.name} />
                <AvatarFallback className="text-xl">{user.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <SheetTitle className="text-2xl">{user.name}</SheetTitle>
                <SheetDescription className="text-sm flex items-center gap-2 mt-1">
                  {user.email}
                  <span className="text-border">•</span>
                  <Badge variant={user.role === "Admin" ? "default" : "secondary"} className="font-normal">{user.role}</Badge>
                </SheetDescription>
              </div>
            </div>
            <div className="flex gap-2 pr-10">
              <Button 
                variant="outline" 
                size="sm" 
                asChild
                className="gap-2 cursor-pointer"
              >
                <a href={`/admin/impersonate?email=${encodeURIComponent(user.email)}`} target="_blank" rel="noreferrer">
                  <LogIn className="h-4 w-4" /> Login as User
                </a>
              </Button>
              {isBlocked ? (
                <Button variant="outline" size="sm" onClick={() => setIsUnblockDialogOpen(true)} className="text-emerald-600 border-emerald-200 hover:bg-emerald-50">Unblock User</Button>
              ) : (
                <Button variant="destructive" size="sm" onClick={() => setIsBlockDialogOpen(true)}>Block User</Button>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-4 gap-4 mt-6">
            <div className="flex flex-col gap-1 p-3 bg-muted/30 rounded-md border border-border">
              <span className="text-xs text-muted-foreground uppercase font-semibold">Account Status</span>
              <StatusBadge 
                status={user.status === "Active" ? "healthy" : user.status === "Idle" ? "idle" : "error"} 
                label={user.status}
              />
            </div>
            <div className="flex flex-col gap-1 p-3 bg-muted/30 rounded-md border border-border">
              <span className="text-xs text-muted-foreground uppercase font-semibold">Customer Health</span>
              <span className="font-medium flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                {user.health}
              </span>
            </div>
            <div className="flex flex-col gap-1 p-3 bg-muted/30 rounded-md border border-border">
              <span className="text-xs text-muted-foreground uppercase font-semibold">Member Since</span>
              <span className="font-medium text-sm">{user.joinedAt}</span>
            </div>
            <div className="flex flex-col gap-1 p-3 bg-muted/30 rounded-md border border-border">
              <span className="text-xs text-muted-foreground uppercase font-semibold">Last Online</span>
              <span className="font-medium text-sm">{user.lastLogin}</span>
            </div>
          </div>
        </SheetHeader>
        
        <div className="mt-6 space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-4 uppercase tracking-wider">Platform Health</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 border border-border rounded-lg bg-card shadow-sm flex items-start gap-3">
                <Activity className="h-5 w-5 text-blue-500 mt-0.5" />
                <div>
                  <h4 className="font-medium">Scheduler Core</h4>
                  <p className="text-sm text-muted-foreground mt-1">Currently operating normally.</p>
                  <Badge variant="outline" className="mt-2 text-emerald-600 bg-emerald-50 border-emerald-200">{user.schedulerStatus}</Badge>
                </div>
              </div>
              <div className="p-4 border border-border rounded-lg bg-card shadow-sm flex items-start gap-3">
                <Mail className="h-5 w-5 text-amber-500 mt-0.5" />
                <div>
                  <h4 className="font-medium">Gmail OAuth</h4>
                  <p className="text-sm text-muted-foreground mt-1">Connection is valid and operational.</p>
                  <Badge variant="outline" className="mt-2 text-amber-600 bg-amber-50 border-amber-200">{user.gmailStatus}</Badge>
                </div>
              </div>
            </div>
          </div>
          
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-4 uppercase tracking-wider">Communication Metrics</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 border border-border rounded-lg bg-card text-center shadow-sm">
                <div className="text-2xl font-bold text-primary">{user.emailsSent.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground mt-1">Emails Sent</div>
              </div>
              <div className="p-4 border border-border rounded-lg bg-card text-center shadow-sm">
                <div className="text-2xl font-bold text-primary">{user.totalReplies.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground mt-1">Total Replies</div>
              </div>
              <div className="p-4 border border-border rounded-lg bg-card text-center shadow-sm">
                <div className="text-2xl font-bold text-primary">{user.replyRate}%</div>
                <div className="text-xs text-muted-foreground mt-1">Reply Rate</div>
              </div>
              <div className="p-4 border border-border rounded-lg bg-card text-center shadow-sm">
                <div className="text-2xl font-bold text-primary">{user.bounceRate}%</div>
                <div className="text-xs text-muted-foreground mt-1">Bounce Rate</div>
              </div>
            </div>
          </div>
        </div>
      </SheetContent>

      <BlockUserDialog 
        isOpen={isBlockDialogOpen} 
        onClose={() => setIsBlockDialogOpen(false)} 
        onBlock={handleBlockAction} 
        userName={user.name} 
      />
      
      <UnblockUserDialog
        isOpen={isUnblockDialogOpen}
        onClose={() => setIsUnblockDialogOpen(false)}
        onConfirm={handleUnblock}
        userName={user.name}
      />
    </Sheet>
  );
}
