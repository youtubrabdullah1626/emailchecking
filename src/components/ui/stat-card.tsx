import { Card, CardContent } from "./card";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
    label?: string;
  };
  sparkline?: ReactNode;
  className?: string;
  subtitle?: string; // Temporarily added for existing Next.js pages
  badge?: ReactNode; // Temporarily added for existing Next.js pages
}

export function StatCard({ title, value, icon, trend, sparkline, className, subtitle, badge }: StatCardProps) {
  return (
    <Card className={cn("hover-elevate transition-shadow", className)}>
      <CardContent className="p-6">
        <div className="flex justify-between items-start">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          {icon && <div className="text-muted-foreground/70">{icon}</div>}
        </div>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
        <div className="mt-4 flex items-baseline gap-4">
          <h2 className="text-3xl font-semibold tracking-tight text-foreground">{value}</h2>
          {trend && (
            <div className={cn(
              "text-sm font-medium",
              trend.isPositive ? "text-emerald-600" : "text-red-600"
            )}>
              {trend.isPositive ? "+" : "-"}{Math.abs(trend.value)}%
              {trend.label && <span className="text-muted-foreground font-normal ml-1">{trend.label}</span>}
            </div>
          )}
          {badge && <div className="ml-auto">{badge}</div>}
        </div>
        {sparkline && <div className="mt-4 h-10 w-full">{sparkline}</div>}
      </CardContent>
    </Card>
  );
}
