"use client";

import React from 'react';
import { FastLink } from '@/components/ui/fast-link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import useSWR, { useSWRConfig } from 'swr';
import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, 
  Users, 
  Layers, 
  MessageSquareReply, 
  Settings, 
  Activity, 
  ServerCog,
  UserCheck,
  FileUp,
  Shield,
  Sliders,
  Megaphone,
  History,
  Database,
  MessageSquareHeart,
  Sparkles,
  Clock,
  Lock
} from "lucide-react";
import { apiClient } from "@/lib/api-client";

interface SidebarProps {
  isMobile?: boolean;
  onNavigate?: () => void;
}

import { isOwnerEmail } from "@/lib/auth/roles";

export function Sidebar({ isMobile, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { mutate } = useSWRConfig();
  
  const user = session?.user as any;
  const normalizedRole = user?.role?.toUpperCase() || "USER";
  const isOwner = isOwnerEmail(user?.email);
  const isFullAdmin = isOwner || ["ADMIN_VIEWER", "ADMIN", "OWNER", "SUPER_ADMIN"].includes(normalizedRole);
  const canViewAdmin = isOwner || ["HELPER", "ADMIN_VIEWER", "ADMIN", "OWNER", "SUPER_ADMIN"].includes(normalizedRole);
  
  // Use SWR to deduplicate this fetch globally with Header and Dashboard
  const { data: summary } = useSWR("/api/dashboard/stats", (url: string) => apiClient<any>(url));

  // Prewarm core routes during idle browser time for 0ms instant page transitions
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const prewarmTimer = setTimeout(() => {
      import("@/lib/speed/preloader").then(({ prewarmRouteData }) => {
        ["/dashboard", "/smart-import", "/prospects", "/sequences", "/timeline", "/replies", "/admin/platform"].forEach((route) => {
          prewarmRouteData(route);
        });
      });
    }, 200);

    const handleGlobalSync = () => {
      mutate(() => true);
    };
    window.addEventListener("storage", handleGlobalSync);
    window.addEventListener("silaer:global_sync", handleGlobalSync);

    return () => {
      clearTimeout(prewarmTimer);
      window.removeEventListener("storage", handleGlobalSync);
      window.removeEventListener("silaer:global_sync", handleGlobalSync);
    };
  }, [mutate]);

  const handleLinkClick = () => {
    if (onNavigate) onNavigate();
  };

  const lockedKeys: string[] = summary?.lockedModules || [];

  const baseNavigation = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, lockKey: null },
    { name: "Prospects", href: "/prospects", icon: Users, lockKey: "PAGE_LOCK_PROSPECTS" },
    { name: "Sequences", href: "/sequences", icon: Activity, lockKey: "PAGE_LOCK_SEQUENCES" },
    { name: "Smart Import", href: "/smart-import", icon: FileUp, lockKey: "PAGE_LOCK_SMART_IMPORT" },
    { name: "Timeline Inspector", href: "/timeline", icon: Clock, lockKey: "PAGE_LOCK_TIMELINE" },
    { name: "Replies", href: "/replies", icon: MessageSquareReply, lockKey: "PAGE_LOCK_REPLIES" },
  ];

  // Smart Sorting: Active unlocked items stay at top, locked items move down to the bottom
  const activeItems = baseNavigation.filter(
    (item) => !item.lockKey || !lockedKeys.includes(item.lockKey)
  );
  const lockedItems = baseNavigation.filter(
    (item) => item.lockKey && lockedKeys.includes(item.lockKey)
  );

  const mainNavigation = [
    ...activeItems,
    ...lockedItems,
  ];

  const adminNavigation = [
    { name: "Customer Feedback", href: "/admin/feedback", icon: MessageSquareHeart },
    { name: "Announcements", href: "/admin/announcements", icon: Megaphone },
    { name: "Analytics", href: "/admin/analytics", icon: Activity },
    ...(isFullAdmin ? [
      { name: "Import History", href: "/admin/import-history", icon: History },
      { name: "Platform Config", href: "/admin/platform", icon: Sliders },
      { name: "Audit Log", href: "/admin/audit", icon: Shield },
      { name: "Active Users", href: "/admin/users", icon: UserCheck },
      { name: "DB Cleanup", href: "/admin/database-maintenance", icon: Database },
      { name: "System Health", href: "/system-health", icon: Activity },
      { name: "Scheduler & Warmup", href: "/admin/scheduler", icon: ServerCog },
    ] : [])
  ];

  return (
    <aside suppressHydrationWarning className={cn(
      "border-r border-sidebar-border bg-sidebar flex flex-col flex-shrink-0 h-full",
      isMobile ? "w-full border-none" : "w-64"
    )}>
      {!isMobile && (
        <div suppressHydrationWarning className="h-16 flex items-center px-4 border-b border-sidebar-border">
          <FastLink href="/dashboard" className="flex items-center gap-3 text-primary group w-full">
            <img
              src="/silaer-logo.png"
              alt="Silaer Logo"
              className="h-10 w-10 object-contain drop-shadow-xs shrink-0 group-hover:scale-105 group-hover:-rotate-1 transition-all duration-200"
            />
            <span className="font-black text-[22px] tracking-tight text-sidebar-foreground group-hover:text-primary transition-colors">
              Silaer
            </span>
          </FastLink>
        </div>
      )}

      <nav suppressHydrationWarning className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        <div suppressHydrationWarning className="px-3 pb-2 pt-1">
          <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 px-1">Main Menu</h3>
          {mainNavigation.map((item) => {
            const isLocked = item.lockKey ? lockedKeys.includes(item.lockKey) : false;
            const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <FastLink 
                key={item.name}
                href={item.href}
                onClick={handleLinkClick}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 mb-1 rounded-md text-sm font-medium transition-all duration-150 active:scale-[0.98]",
                  isActive 
                    ? "bg-primary/15 text-primary shadow-sm border-r-4 border-primary rounded-r-none font-semibold" 
                    : isLocked
                    ? "text-sidebar-foreground/50 hover:bg-sidebar-accent/30 hover:text-sidebar-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground hover:translate-x-1"
                )}
              >
                <item.icon className={cn("h-4 w-4", isActive ? "text-primary" : isLocked ? "text-muted-foreground/60" : "text-muted-foreground")} />
                <span className="flex-1 truncate">{item.name}</span>
                {isLocked && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground/80 border border-border/40 shrink-0">
                    <Lock className="h-2.5 w-2.5" />
                    Soon
                  </span>
                )}
              </FastLink>
            );
          })}
        </div>

        {canViewAdmin && (
          <div suppressHydrationWarning className="px-3 py-2 mt-2">
            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 px-1">Administration</h3>
            {adminNavigation.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href);
              return (
                <FastLink 
                  key={item.name}
                  href={item.href}
                  onClick={handleLinkClick}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 mb-1 rounded-md text-sm font-medium transition-all duration-150 active:scale-[0.98]",
                    isActive 
                      ? "bg-primary/15 text-primary shadow-sm border-r-4 border-primary rounded-r-none font-semibold" 
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground hover:translate-x-1"
                  )}
                >
                  <item.icon className={cn("h-4 w-4", isActive ? "text-primary" : "text-muted-foreground")} />
                  {item.name}
                </FastLink>
              );
            })}
          </div>
        )}
      </nav>
      
      <div suppressHydrationWarning className="p-3 border-t border-sidebar-border">
        <button
          type="button"
          onClick={() => {
            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("outreachiq:open_feedback", { detail: { source: "sidebar_footer" } }));
            }
          }}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-primary/5 hover:bg-primary/10 text-primary border border-primary/15 transition-all text-xs font-semibold group cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-amber-500 group-hover:rotate-12 transition-transform" />
            <span>Give Feedback</span>
          </span>
          <span className="text-[10px] bg-primary/10 px-1.5 py-0.5 rounded text-primary font-bold">5★</span>
        </button>
      </div>
    </aside>
  );
}
