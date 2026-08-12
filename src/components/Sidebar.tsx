"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
  History
} from "lucide-react";
import { apiClient } from "@/lib/api-client";

interface SidebarProps {
  isMobile?: boolean;
  onNavigate?: () => void;
}

export function Sidebar({ isMobile, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  
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
    { name: "Announcements", href: "/admin/announcements", icon: Megaphone },
    { name: "Import History", href: "/admin/import-history", icon: History },
    { name: "Platform Config", href: "/admin/platform", icon: Sliders },
    { name: "Audit Log", href: "/admin/audit", icon: Shield },
    { name: "Active Users", href: "/admin/users", icon: UserCheck },
    { name: "Analytics", href: "/admin/analytics", icon: Activity },
    { name: "System Health", href: "/system-health", icon: Activity },
    { name: "Scheduler", href: "/scheduler", icon: ServerCog },
  ];

  const schedulerStatus = summary?.schedulerStatus?.toLowerCase() || 'unknown';
  const geminiStatus = summary?.geminiConfigured ? 'connected' : 'error';

  return (
    <aside suppressHydrationWarning className={cn(
      "border-r border-sidebar-border bg-sidebar flex flex-col flex-shrink-0 h-full",
      isMobile ? "w-full border-none" : "w-64"
    )}>
      {!isMobile && (
        <div className="h-16 flex items-center px-6 border-b border-sidebar-border">
          <div className="flex items-center gap-2 text-primary">
            <Layers className="h-6 w-6" />
            <span className="font-bold text-lg tracking-tight text-sidebar-foreground">OutreachIQ</span>
          </div>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        <div className="px-3 pb-2 pt-1">
          <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 px-1">Main Menu</h3>
          {mainNavigation.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link 
                key={item.name}
                href={item.href}
                prefetch={true}
                onClick={handleLinkClick}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 mb-1 rounded-md text-sm font-medium transition-all duration-200",
                  isActive 
                    ? "bg-primary/15 text-primary shadow-sm border-r-4 border-primary rounded-r-none" 
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground hover:translate-x-1"
                )}
              >
                <item.icon className={cn("h-4 w-4", isActive ? "text-primary" : "text-muted-foreground")} />
                {item.name}
              </Link>
            );
          })}
        </div>

        <div className="px-3 py-2 mt-2">
          <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 px-1">Administration</h3>
          {adminNavigation.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href);
            return (
              <Link 
                key={item.name}
                href={item.href}
                prefetch={true}
                onClick={handleLinkClick}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 mb-1 rounded-md text-sm font-medium transition-all duration-200",
                  isActive 
                    ? "bg-primary/15 text-primary shadow-sm border-r-4 border-primary rounded-r-none" 
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground hover:translate-x-1"
                )}
              >
                <item.icon className={cn("h-4 w-4", isActive ? "text-primary" : "text-muted-foreground")} />
                {item.name}
              </Link>
            );
          })}
        </div>
      </nav>
      
      <div className="p-4 border-t border-sidebar-border">
        <div className="px-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Scheduler</span>
            <div className="flex items-center gap-1.5">
              <span className={cn(
                "h-2 w-2 rounded-full",
                schedulerStatus === 'running' ? "bg-emerald-500" :
                (schedulerStatus === 'error' || schedulerStatus === 'failed') ? "bg-red-500" : "bg-amber-500"
              )} />
              <span className="text-xs text-sidebar-foreground">{schedulerStatus}</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
