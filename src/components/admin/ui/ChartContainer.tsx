import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3 } from "lucide-react";

interface ChartContainerProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
  isLoading?: boolean;
  isError?: boolean;
  isEmpty?: boolean;
  className?: string;
}

export function ChartContainer({
  title,
  description,
  children,
  isLoading,
  isError,
  isEmpty,
  className,
}: ChartContainerProps) {
  return (
    <Card className={cn("flex flex-col overflow-hidden border-border shadow-sm", className)}>
      <CardHeader className="border-b border-border bg-muted/10 pb-4">
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="p-6 flex-1 flex flex-col relative min-h-[300px]">
        {isLoading && (
          <div className="absolute inset-0 flex items-end justify-between p-6 gap-2">
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <Skeleton key={i} className="w-full rounded-t-sm" style={{ height: `${Math.max(20, Math.random() * 100)}%` }} />
            ))}
          </div>
        )}

        {isError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-destructive/5">
            <span className="text-destructive font-semibold mb-1">Failed to load chart data</span>
            <span className="text-sm text-destructive/80">Check system logs or try again later.</span>
          </div>
        )}

        {isEmpty && !isLoading && !isError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <BarChart3 className="h-6 w-6 text-muted-foreground/50" />
            </div>
            <span className="text-muted-foreground font-medium">No data available for this period</span>
          </div>
        )}

        {!isLoading && !isError && !isEmpty && (
          <div className="flex-1 w-full h-full relative">
            {children ? children : (
              <div className="absolute inset-0 border-2 border-dashed border-border rounded-lg flex items-center justify-center bg-muted/5">
                <span className="text-muted-foreground text-sm font-medium">Chart Integration Placeholder</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
