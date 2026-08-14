"use client";

import React from 'react';
import { FastLink } from '@/components/ui/fast-link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import useSWR from 'swr';
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
  Sparkles
} from "lucide-react";
import { apiClient } from "@/lib/api-client";

interface SidebarProps {
  isMobile?: boolean;
  onNavigate?: () => void;
}

export function Sidebar({ isMobile, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  
  const user = session?.user as any;
  const normalizedRole = user?.role?.toUpperCase() || "USER";
  const isFullAdmin = ["ADMIN_VIEWER", "ADMIN", "OWNER"].includes(normalizedRole) || user?.email === "youtubrabdullah1626@gmail.com";
  const canViewAdmin = ["HELPER", "ADMIN_VIEWER", "ADMIN", "OWNER"].includes(normalizedRole) || user?.email === "youtubrabdullah1626@gmail.com";
  
  // Use SWR to deduplicate this fetch globally with Header and Dashboard
  const { data: summary } = useSWR("/api/dashboard/stats", (url: string) => apiClient<any>(url));

  const handleLinkClick = () => {
    if (onNavigate) onNavigate();
  };

  const mainNavigation = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Prospects", href: "/prospects", icon: Users },
    { name: "Sequences", href: "/sequences", icon: Activity },
    { name: "Smart Import", href: "/smart-import", icon: FileUp },
    { name: "Replies", href: "/replies", icon: MessageSquareReply },
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
      { name: "Scheduler", href: "/scheduler", icon: ServerCog },
    ] : [])
  ];

  return (
    <aside suppressHydrationWarning className={cn(
      "border-r border-sidebar-border bg-sidebar flex flex-col flex-shrink-0 h-full",
      isMobile ? "w-full border-none" : "w-64"
    )}>
      {!isMobile && (
        <div suppressHydrationWarning className="h-16 flex items-center px-6 border-b border-sidebar-border">
          <div suppressHydrationWarning className="flex items-center gap-2 text-primary">
            <Layers className="h-6 w-6" />
            <span className="font-bold text-lg tracking-tight text-sidebar-foreground">OutreachIQ</span>
          </div>
        </div>
      )}

      <nav suppressHydrationWarning className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        <div suppressHydrationWarning className="px-3 pb-2 pt-1">
          <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 px-1">Main Menu</h3>
          {mainNavigation.map((item) => {
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
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground hover:translate-x-1"
                )}
              >
                <item.icon className={cn("h-4 w-4", isActive ? "text-primary" : "text-muted-foreground")} />
                {item.name}
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
