import React from "react";
import { cn } from "@/lib/utils";

interface SectionContainerProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}

export function SectionContainer({
  title,
  description,
  children,
  className,
  action,
}: SectionContainerProps) {
  return (
    <section className={cn("flex flex-col space-y-4 mb-10 w-full", className)}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-foreground">{title}</h2>
          {description && (
            <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
        {action && <div>{action}</div>}
      </div>
      <div className="w-full">{children}</div>
    </section>
  );
}
