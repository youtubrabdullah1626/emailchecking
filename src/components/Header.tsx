"use client";

import React, { useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { RefreshCw, Bell, Menu, Zap, TrendingUp, Camera, X, Settings, LogOut } from "lucide-react";
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
import { AlertCircle, MessageSquare, Rocket, AlertTriangle, Info } from "lucide-react";
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
  const { data: accountStats } = useSWR("/api/dashboard/header-stats", (url: string) => apiClient<any>(url));
  const { data: globalStats } = useSWR("/api/dashboard/stats", (url: string) => apiClient<any>(url));
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
          <div className="flex items-center gap-2 bg-primary/5 backdrop-blur-sm px-3 py-1.5 rounded-full border border-primary/20 shadow-sm transition-colors hover:bg-primary/10">
            <div className="flex -space-x-2 mr-1">
              <span className="h-6 w-6 rounded-full bg-primary flex items-center justify-center text-primary-foreground shadow-sm ring-2 ring-background">
                <Zap className="h-3 w-3 fill-current" />
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] font-bold text-foreground leading-none tracking-wide uppercase flex items-center gap-1">
                Outreach Flow
              </span>
              <span className="text-[10px] text-muted-foreground font-medium leading-none mt-0.5 flex items-center gap-1">
                <TrendingUp className="h-3 w-3 text-primary" />
                {globalStats ? `${globalStats.emailsSentToday || 0} Sent Today • ${globalStats.repliesToday || 0} Replies Today` : 'Calculating metrics...'}
              </span>
            </div>
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-2 md:gap-4">
        <div className="hidden md:flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Account:</span>
          <span className="font-medium">
            {accountStats === undefined ? (
              <span className="animate-pulse bg-slate-200 text-transparent rounded px-1">Loading account...</span>
            ) : accountStats?.connectedGmail ? (
              accountStats.connectionStatus === 'CONNECTED' 
                ? accountStats.connectedGmail 
                : <span className="text-destructive">{accountStats.connectedGmail} (Disconnected)</span>
            ) : (
              'Not connected'
            )}
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
              <span className="font-semibold text-sm">Global Announcements</span>
              {notifications.length > 0 && !isClearing && (
                <button 
                  onClick={handleClearAll}
                  className="text-xs text-muted-foreground hover:text-foreground font-medium transition-colors"
                >
                  Mark all as read
                </button>
              )}
            </div>
            <DropdownMenuSeparator />
            <div className={cn("max-h-[300px] overflow-y-auto transition-all duration-400 ease-in-out", isClearing ? "opacity-0 translate-x-8" : "opacity-100 translate-x-0")}>
              {notifications.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  You're all caught up!
                </div>
              ) : (
                notifications.map((notif: any) => (
                  <DropdownMenuItem key={notif.id} asChild className="cursor-pointer">
                    <Link href={notif.link || "#"} prefetch={true} className="flex items-start gap-3 p-3 w-full">
                      <div className="mt-0.5 flex-shrink-0">
                        {notif.type === "feature" ? (
                          <Rocket className="h-4 w-4 text-purple-500" />
                        ) : notif.type === "warning" ? (
                          <AlertTriangle className="h-4 w-4 text-orange-500" />
                        ) : (
                          <Info className="h-4 w-4 text-blue-500" />
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="relative ml-4 group block rounded-full overflow-hidden border-2 border-transparent ring-2 ring-primary/30 transition-all duration-300 hover:ring-primary/60 shadow-sm hover:shadow-md focus:outline-none hover:-translate-y-0.5">
                <Avatar className="h-10 w-10 border border-primary/20">
                  {avatarUrl && <AvatarImage src={avatarUrl} alt="User Avatar" className="object-cover" />}
                  <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold tracking-wider">
                    IQ
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 font-medium">
              <div className="px-2 py-1.5 text-xs text-muted-foreground font-semibold uppercase tracking-wider">My Account</div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link prefetch={true} href="/settings" className="w-full cursor-pointer flex items-center py-2">
                  <Settings className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>Settings</span>
                </Link>
              </DropdownMenuItem>
              <DialogTrigger asChild>
                <DropdownMenuItem className="cursor-pointer flex items-center py-2">
                  <Camera className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>Change Photo</span>
                </DropdownMenuItem>
              </DialogTrigger>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="cursor-pointer flex items-center py-2 text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/50">
                <LogOut className="mr-2 h-4 w-4 text-red-600" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DialogContent className="sm:max-w-md bg-card/95 backdrop-blur-md border-border flex flex-col items-center justify-center py-12">
            <div className="relative group rounded-full overflow-hidden ring-4 ring-primary/20 shadow-2xl">
              <Avatar className="h-56 w-56 border-4 border-background bg-primary/5">
                {avatarUrl && <AvatarImage src={avatarUrl} alt="User Avatar" className="object-cover" />}
                <AvatarFallback className="bg-primary/10 text-primary text-7xl font-bold tracking-wider">
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
