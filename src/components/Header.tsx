"use client";

import React, { useState, useEffect } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { signOut, useSession } from 'next-auth/react';
import { RefreshCw, Bell, Menu, Zap, TrendingUp, Camera, X, Settings, LogOut, Sparkles } from "lucide-react";
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
import { FastLink } from "@/components/ui/fast-link";
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
  const [cachedHeader, setCachedHeader] = useState<any>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("silaer_cached_header_stats");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && (parsed.inboxCount > 0 || parsed.connectedGmail)) setCachedHeader(parsed);
      }
    } catch {}

    const handleGlobalSync = () => {
      mutate(() => true);
    };
    window.addEventListener("storage", handleGlobalSync);
    window.addEventListener("silaer:global_sync", handleGlobalSync);
    return () => {
      window.removeEventListener("storage", handleGlobalSync);
      window.removeEventListener("silaer:global_sync", handleGlobalSync);
    };
  }, [mutate]);

  const { data: rawAccountStats } = useSWR(
    "/api/dashboard/header-stats",
    (url: string) => apiClient<any>(url),
    {
      refreshInterval: 4000,
      revalidateOnFocus: true,
      dedupingInterval: 2000,
      onSuccess: (data) => {
        if (data && (data.inboxCount > 0 || data.connectedGmail) && typeof window !== "undefined") {
          try {
            localStorage.setItem("silaer_cached_header_stats", JSON.stringify(data));
          } catch {}
        }
      }
    }
  );

  const accountStats = rawAccountStats || cachedHeader;

  const { data: globalStats } = useSWR(
    "/api/dashboard/stats",
    (url: string) => apiClient<any>(url),
    {
      refreshInterval: 6000,
      revalidateOnFocus: true,
      dedupingInterval: 2000,
    }
  );
  const { data: notifData } = useSWR("/api/notifications/important", (url: string) => apiClient<any>(url), { refreshInterval: 15000 });
  
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // Real NextAuth session — name, email, avatar from Google
  const { data: nextAuthSession } = useSession();
  const sessionUser = nextAuthSession?.user;

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
    <header className="h-16 border-b border-border bg-card/95 backdrop-blur-xs flex items-center justify-between px-4 md:px-8 flex-shrink-0 z-30">
      <div className="flex items-center flex-1 gap-4 md:gap-6">
        <Button 
          variant="ghost" 
          size="icon" 
          className="md:hidden text-muted-foreground hover:text-foreground"
          onClick={onMenuClick}
        >
          <Menu className="h-5 w-5" />
        </Button>
        <div className="hidden lg:flex items-center gap-3">
          <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg border border-border bg-secondary/50 shadow-2xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-foreground tracking-tight">System Live</span>
              <span className="text-muted-foreground">•</span>
              <span className="text-muted-foreground font-medium font-mono text-[11px]">
                {mounted
                  ? `${Math.max(rawAccountStats?.emailsSentToday ?? 0, globalStats?.emailsSentToday ?? 0, cachedHeader?.emailsSentToday ?? 0)} Sent • ${Math.max(rawAccountStats?.repliesToday ?? 0, globalStats?.repliesToday ?? 0, cachedHeader?.repliesToday ?? 0)} Replies Today`
                  : 'Syncing state...'}
              </span>
            </div>
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-2 md:gap-3">
        <div className="hidden md:flex items-center gap-2 text-xs">
          <span className="text-muted-foreground font-medium">
            {((rawAccountStats?.inboxCount ?? cachedHeader?.inboxCount ?? 2) > 1) ? "Active Fleet:" : "Sending Account:"}
          </span>
          <div>
            {!mounted ? (
              <span className="animate-pulse bg-muted text-transparent rounded px-2 py-0.5 text-xs font-mono">loading...</span>
            ) : ((rawAccountStats?.inboxCount ?? cachedHeader?.inboxCount ?? 2) > 1) ? (
              <FastLink 
                href="/settings" 
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
              >
                <Sparkles className="h-3 w-3" /> {rawAccountStats?.connectedGmail || cachedHeader?.connectedGmail || "2 Inboxes Rotating"}
              </FastLink>
            ) : accountStats?.connectedGmail ? (
              accountStats.connectionStatus === 'CONNECTED' ? (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md font-mono text-xs bg-secondary border border-border text-foreground font-medium">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  {accountStats.connectedGmail}
                </span>
              ) : (
                <FastLink href="/settings" className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md font-mono text-xs bg-destructive/10 border border-destructive/20 text-destructive hover:bg-destructive/15">
                  <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                  {accountStats.connectedGmail} (Disconnected) &rarr;
                </FastLink>
              )
            ) : (
              <FastLink href="/settings" className="text-primary hover:underline font-semibold flex items-center gap-1">
                + Connect Account
              </FastLink>
            )}
          </div>
        </div>
        
        <div className="h-4 w-px bg-border hidden md:block mx-1" />
        
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
              {mounted && notifications.length > 0 ? (
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
                  You&apos;re all caught up!
                </div>
              ) : (
                notifications.map((notif: any) => (
                  <DropdownMenuItem key={notif.id} asChild className="cursor-pointer">
                    <FastLink href={notif.link || "#"} className="flex items-start gap-3 p-3 w-full">
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
                    </FastLink>
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
                  {(avatarUrl || sessionUser?.image) && <AvatarImage src={avatarUrl || sessionUser?.image || ''} alt="User Avatar" className="object-cover" />}
                  <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold tracking-wider">
                    {sessionUser?.name ? sessionUser.name.slice(0, 2).toUpperCase() : 'IQ'}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 font-medium">
              <div className="px-3 py-2">
                <p className="text-sm font-semibold text-foreground truncate">{sessionUser?.name || 'My Account'}</p>
                <p className="text-xs text-muted-foreground truncate">{sessionUser?.email || ''}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <FastLink href="/settings" className="w-full cursor-pointer flex items-center py-2">
                  <Settings className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>Settings</span>
                </FastLink>
              </DropdownMenuItem>
              <DropdownMenuItem 
                className="cursor-pointer flex items-center py-2 text-foreground hover:text-amber-500 transition-colors"
                onClick={() => {
                  if (typeof window !== "undefined") {
                    window.dispatchEvent(new CustomEvent("outreachiq:open_feedback", { detail: { source: "header_menu" } }));
                  }
                }}
              >
                <Sparkles className="mr-2 h-4 w-4 text-amber-500" />
                <span>Give Feedback</span>
              </DropdownMenuItem>
              <DialogTrigger asChild>
                <DropdownMenuItem className="cursor-pointer flex items-center py-2">
                  <Camera className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>Change Photo</span>
                </DropdownMenuItem>
              </DialogTrigger>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                className="cursor-pointer flex items-center py-2 text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/50"
                onClick={() => signOut({ callbackUrl: '/login' })}
              >
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
                  {sessionUser?.name ? sessionUser.name.slice(0, 2).toUpperCase() : 'IQ'}
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
