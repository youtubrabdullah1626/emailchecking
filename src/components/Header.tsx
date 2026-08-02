"use client";

import React, { useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { RefreshCw, Bell, Menu, Zap, TrendingUp, Camera, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { apiClient } from "@/lib/api-client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { AlertCircle, MessageSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";

export interface HeaderProps {
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { mutate } = useSWRConfig();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [localCleared, setLocalCleared] = useState(false);

  const { data: summary } = useSWR("/api/dashboard/stats", (url: string) => apiClient<any>(url));
  const { data: notifData } = useSWR("/api/notifications/important", (url: string) => apiClient<any>(url));
  
  const [lastClearedTime, setLastClearedTime] = useState<number>(0);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // Initialize from localStorage on mount
  React.useEffect(() => {
    const saved = localStorage.getItem("last_cleared_notifications");
    if (saved) {
      setLastClearedTime(parseInt(saved, 10));
    }
    const savedAvatar = localStorage.getItem('user_avatar');
    if (savedAvatar) {
      setAvatarUrl(savedAvatar);
    }
  }, []);

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        setAvatarUrl(result);
        localStorage.setItem('user_avatar', result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveAvatar = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setAvatarUrl(null);
    localStorage.removeItem('user_avatar');
  };

  const handleClearAll = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsClearing(true);
    const now = Date.now();
    setTimeout(() => {
      localStorage.setItem("last_cleared_notifications", now.toString());
      setLastClearedTime(now);
      setIsClearing(false);
    }, 400); // 400ms duration for the smooth slide-out animation
  };

  const notifications = (notifData?.notifications || []).filter((n: any) => {
    return new Date(n.timestamp).getTime() > lastClearedTime;
  });

  return (
    <header className="h-16 border-b border-border bg-card flex items-center justify-between px-4 md:px-8 flex-shrink-0">
      <div className="flex items-center flex-1 gap-4 md:gap-6">
        <Button 
          variant="ghost" 
          size="icon" 
          className="md:hidden text-muted-foreground hover:text-foreground"
          onClick={onMenuClick}
        >
          <Menu className="h-5 w-5" />
        </Button>
        <div className="hidden lg:flex items-center gap-4">
          <div className="flex items-center gap-2 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 px-3 py-1.5 rounded-full border border-indigo-500/20 shadow-sm">
            <div className="flex -space-x-2 mr-1">
              <span className="h-6 w-6 rounded-full bg-indigo-500 flex items-center justify-center text-white shadow-sm ring-2 ring-background">
                <Zap className="h-3 w-3 fill-white" />
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-400 leading-none tracking-wide uppercase flex items-center gap-1">
                Outreach Flow
              </span>
              <span className="text-[10px] text-muted-foreground font-medium leading-none mt-0.5 flex items-center gap-1">
                <TrendingUp className="h-3 w-3 text-emerald-500" />
                {summary ? `${summary.emailsSentToday || 0} Sent Today • ${summary.totalReplies || 0} Total Replies` : 'Calculating metrics...'}
              </span>
            </div>
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-2 md:gap-4">
        <div className="hidden md:flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Account:</span>
          <span className="font-medium">
            {summary?.connectedGmail 
              ? (summary.connectionStatus === 'CONNECTED' 
                  ? summary.connectedGmail 
                  : <span className="text-destructive">{summary.connectedGmail} (Disconnected)</span>)
              : 'Not connected'}
          </span>
        </div>
        
        <div className="h-4 w-px bg-border hidden md:block mx-2" />
        
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-9 w-9 text-muted-foreground hover:text-foreground"
          onClick={async () => {
            setIsRefreshing(true);
            await mutate(() => true, undefined, { revalidate: true });
            setTimeout(() => setIsRefreshing(false), 500); // minimum spin time for smooth feel
          }}
        >
          <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
        </Button>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground relative">
              <Bell className="h-4 w-4" />
              {notifications.length > 0 ? (
                <span className="absolute top-2 right-2.5 h-1.5 w-1.5 rounded-full bg-red-500" />
              ) : null}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2">
              <span className="font-semibold text-sm">Important Notifications</span>
              {notifications.length > 0 && !isClearing && (
                <button 
                  onClick={handleClearAll}
                  className="text-xs text-muted-foreground hover:text-foreground font-medium transition-colors"
                >
                  Clear All
                </button>
              )}
            </div>
            <DropdownMenuSeparator />
            <div className={cn("max-h-[300px] overflow-y-auto transition-all duration-400 ease-in-out", isClearing ? "opacity-0 translate-x-8" : "opacity-100 translate-x-0")}>
              {notifications.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No new notifications
                </div>
              ) : (
                notifications.map((notif: any) => (
                  <DropdownMenuItem key={notif.id} asChild className="cursor-pointer">
                    <Link href={notif.link} className="flex items-start gap-3 p-3 w-full">
                      <div className="mt-0.5 flex-shrink-0">
                        {notif.type === "error" ? (
                          <AlertCircle className="h-4 w-4 text-destructive" />
                        ) : (
                          <MessageSquare className="h-4 w-4 text-primary" />
                        )}
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="font-medium text-sm leading-none">{notif.title}</span>
                        <span className="text-xs text-muted-foreground leading-snug">{notif.message}</span>
                        <span className="text-[10px] text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(notif.timestamp), { addSuffix: true })}
                        </span>
                      </div>
                    </Link>
                  </DropdownMenuItem>
                ))
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
        
        <div className="relative ml-2 group">
          <label htmlFor="avatar-upload" className="cursor-pointer block relative rounded-full overflow-hidden border-2 border-transparent ring-2 ring-transparent transition-all duration-300 hover:ring-primary/30 hover:border-border shadow-sm">
            <Avatar className="h-9 w-9">
              {avatarUrl && <AvatarImage src={avatarUrl} alt="User Avatar" className="object-cover" />}
              <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-xs font-semibold tracking-wider">
                IQ
              </AvatarFallback>
            </Avatar>
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <Camera className="h-4 w-4 text-white" />
            </div>
          </label>
          {avatarUrl && (
            <button 
              onClick={handleRemoveAvatar}
              className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 hover:bg-red-600 shadow-sm z-10"
              title="Remove picture"
            >
              <X className="h-3 w-3" />
            </button>
          )}
          <input 
            id="avatar-upload" 
            type="file" 
            accept="image/*" 
            className="hidden" 
            onChange={handleAvatarUpload} 
          />
        </div>
      </div>
    </header>
  );
}
