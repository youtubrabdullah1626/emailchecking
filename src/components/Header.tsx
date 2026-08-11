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
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AlertCircle, MessageSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { ImageCropper } from "./ImageCropper";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export interface HeaderProps {
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { mutate } = useSWRConfig();
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [localCleared, setLocalCleared] = useState(false);

  const { data: summary } = useSWR("/api/dashboard/stats", (url: string) => apiClient<any>(url));
  const { data: notifData } = useSWR("/api/notifications/important", (url: string) => apiClient<any>(url));
  
  const [lastClearedTime, setLastClearedTime] = useState<number>(0);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [selectedFileUrl, setSelectedFileUrl] = useState<string | null>(null);

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
        setSelectedFileUrl(result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCropComplete = (croppedBase64: string) => {
    setAvatarUrl(croppedBase64);
    try {
      localStorage.setItem('user_avatar', croppedBase64);
    } catch (err) {
      console.error('Failed to save avatar', err);
    }
    setSelectedFileUrl(null);
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
                {summary ? `${summary.emailsSentToday || 0} Sent Today • ${summary.repliesToday || 0} Replies Today` : 'Calculating metrics...'}
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
        
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-9 w-9 text-muted-foreground hover:text-foreground"
                onClick={async () => {
                  setIsRefreshing(true);
                  toast.loading("Optimizing system performance & clearing caches...", { id: "refresh" });
                  
                  // Mutate all SWR cached data across the app
                  await mutate(() => true, undefined, { revalidate: true });
                  
                  // Refresh Next.js server components cache
                  router.refresh();
                  
                  setTimeout(() => {
                    setIsRefreshing(false);
                    toast.success("System Optimized for Fastest Speed!", { id: "refresh" });
                  }, 800);
                }}
              >
                <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Clear system caches & optimize speed</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        
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
                    <Link href={notif.link} prefetch={true} className="flex items-start gap-3 p-3 w-full">
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
        
        <Dialog>
          <DialogTrigger asChild>
            <button className="relative ml-4 group block rounded-full overflow-hidden border-2 border-transparent ring-2 ring-primary/20 transition-all duration-300 hover:ring-primary/50 shadow-md hover:shadow-lg focus:outline-none">
              <Avatar className="h-11 w-11 border border-border/50">
                {avatarUrl && <AvatarImage src={avatarUrl} alt="User Avatar" className="object-cover" />}
                <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-sm font-bold tracking-wider">
                  IQ
                </AvatarFallback>
              </Avatar>
            </button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md bg-card/95 backdrop-blur-md border-border flex flex-col items-center justify-center py-12">
            <div className="relative group rounded-full overflow-hidden ring-4 ring-primary/20 shadow-2xl">
              <Avatar className="h-56 w-56 border-4 border-background">
                {avatarUrl && <AvatarImage src={avatarUrl} alt="User Avatar" className="object-cover" />}
                <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-7xl font-bold tracking-wider">
                  IQ
                </AvatarFallback>
              </Avatar>
            </div>
            
            <div className="mt-8 flex gap-4 w-full px-8 justify-center">
              <label htmlFor="avatar-upload-modal" className="cursor-pointer">
                <div className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm">
                  <Camera className="mr-2 h-4 w-4" /> Change Photo
                </div>
              </label>
              {avatarUrl && (
                <Button variant="outline" className="flex gap-2 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={handleRemoveAvatar}>
                  <X className="h-4 w-4" /> Remove
                </Button>
              )}
            </div>
            
            <input 
              id="avatar-upload-modal" 
              type="file" 
              accept="image/*" 
              className="hidden" 
              onChange={handleAvatarUpload} 
            />
          </DialogContent>
        </Dialog>

        {selectedFileUrl && (
          <ImageCropper 
            imageSrc={selectedFileUrl} 
            onCropComplete={handleCropComplete} 
            onCancel={() => setSelectedFileUrl(null)} 
          />
        )}
      </div>
    </header>
  );
}
