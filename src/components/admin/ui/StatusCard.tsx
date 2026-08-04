import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { HealthStatus } from "@/app/admin/analytics/types";

interface StatusCardProps {
  title: string;
  status?: HealthStatus;
  description?: string;
  isLoading?: boolean;
  isError?: boolean;
  className?: string;
}

export function StatusCard({
  title,
  status = "UNKNOWN",
  description,
  isLoading,
  isError,
  className,
}: StatusCardProps) {
  if (isLoading) {
    return (
      <Card className={cn("overflow-hidden border-border shadow-sm", className)}>
        <CardContent className="p-4 flex items-center justify-between">
          <div className="space-y-2 w-full">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-8 w-16 rounded-full" />
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className={cn("overflow-hidden border-destructive/20 bg-destructive/5 shadow-sm", className)}>
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-sm text-destructive">{title}</h3>
            <p className="text-xs text-destructive/80">Failed to load status</p>
          </div>
          <div className="h-3 w-3 rounded-full bg-destructive animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  const statusConfig: Record<HealthStatus, { badge: string; dot: string; label: string }> = {
    HEALTHY: { badge: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400", dot: "bg-emerald-500", label: "Healthy" },
    WARNING: { badge: "bg-amber-500/10 text-amber-700 dark:text-amber-400", dot: "bg-amber-500", label: "Warning" },
    CRITICAL: { badge: "bg-destructive/10 text-destructive", dot: "bg-destructive animate-pulse", label: "Critical" },
    UNKNOWN: { badge: "bg-muted text-muted-foreground", dot: "bg-muted-foreground", label: "Unknown" },
  };

  const config = statusConfig[status];

  return (
    <Card className={cn("overflow-hidden border-border shadow-sm transition-colors hover:bg-muted/30", className)}>
      <CardContent className="p-4 flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm text-foreground truncate">{title}</h3>
          {description && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">{description}</p>
          )}
        </div>
        
        <div className={cn("flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap", config.badge)}>
          <span className={cn("h-2 w-2 rounded-full", config.dot)} />
          {config.label}
        </div>
      </CardContent>
    </Card>
  );
}
