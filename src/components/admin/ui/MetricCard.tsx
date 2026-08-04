import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface MetricCardProps {
  title: React.ReactNode;
  value: React.ReactNode;
  secondaryValue?: React.ReactNode;
  trend?: {
    value: string;
    isPositive?: boolean;
    isNeutral?: boolean;
    label?: string;
  };
  icon?: React.ReactNode;
  isLoading?: boolean;
  isError?: boolean;
  isEmpty?: boolean;
  className?: string;
}

export function MetricCard({
  title,
  value,
  secondaryValue,
  trend,
  icon,
  isLoading,
  isError,
  isEmpty,
  className,
}: MetricCardProps) {
  if (isLoading) {
    return (
      <Card className={cn("overflow-hidden border-border shadow-sm", className)}>
        <CardContent className="p-5 flex flex-col justify-between h-full space-y-4">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-4 w-3/4" />
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className={cn("overflow-hidden border-destructive/20 bg-destructive/5 shadow-sm", className)}>
        <CardContent className="p-5 flex flex-col justify-center items-center h-full text-center space-y-2">
          <span className="text-destructive font-medium text-sm">Failed to load metric</span>
          <span className="text-xs text-muted-foreground">Please try refreshing</span>
        </CardContent>
      </Card>
    );
  }

  if (isEmpty) {
    return (
      <Card className={cn("overflow-hidden border-border border-dashed shadow-sm", className)}>
        <CardContent className="p-5 flex flex-col justify-center items-center h-full text-center">
          <span className="text-muted-foreground text-sm">No data available</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("overflow-hidden border-border shadow-sm flex flex-col", className)}>
      <CardContent className="p-5 flex-1 flex flex-col justify-between relative">
        {icon && (
          <div className="absolute top-5 right-5 text-muted-foreground/50">
            {icon}
          </div>
        )}
        
        <div>
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
            {title}
          </h3>
          <div className="text-2xl font-black text-foreground tracking-tight">
            {value}
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          {trend && (
            <span
              className={cn(
                "text-xs font-bold px-1.5 py-0.5 rounded-md",
                trend.isNeutral
                  ? "bg-muted text-muted-foreground"
                  : trend.isPositive !== false
                  ? "bg-emerald-500/10 text-emerald-600"
                  : "bg-destructive/10 text-destructive"
              )}
            >
              {trend.value}
            </span>
          )}
          {secondaryValue && (
            <span className="text-xs font-medium text-muted-foreground truncate">
              {secondaryValue}
            </span>
          )}
          {trend?.label && !secondaryValue && (
            <span className="text-xs font-medium text-muted-foreground truncate">
              {trend.label}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
