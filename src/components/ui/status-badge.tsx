import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const statusBadgeVariants = cva(
  "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold tracking-wide transition-colors border",
  {
    variants: {
      status: {
        active: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
        running: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
        healthy: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
        positive: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
        keep_active: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
        sent: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
        reviewed: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
        
        completed: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20",
        auto_processed: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20",

        paused: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
        stopped: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
        pending_review: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
        degraded: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",

        pending: "bg-secondary text-secondary-foreground border-border/80",
        uncontacted: "bg-secondary text-secondary-foreground border-border/80",
        neutral: "bg-secondary text-secondary-foreground border-border/80",
        idle: "bg-secondary text-secondary-foreground border-border/80",
        none: "bg-secondary text-secondary-foreground border-border/80",
        dismissed: "bg-secondary text-muted-foreground border-border/80",
        skipped: "bg-secondary text-muted-foreground border-border/80",
        unknown: "bg-secondary text-muted-foreground border-border/80",

        bounced: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20",
        unsubscribed: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20",
        failed: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20",
        error: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20",
        unhealthy: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20",
        negative: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20",
        stop_sequence: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20",
        spam: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20",

        auto_reply: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20",
        ooo: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20",
      },
    },
    defaultVariants: {
      status: "neutral",
    },
  }
);

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof statusBadgeVariants> {
  label?: string;
  dot?: boolean;
}

export function StatusBadge({ className, status, label, dot, ...props }: StatusBadgeProps) {
  const displayLabel = label || (status ? status.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()) : "");
  
  return (
    <div className={cn(statusBadgeVariants({ status }), className)} {...props}>
      {dot && (
        <span className="mr-1.5 flex h-1.5 w-1.5">
          <span className={cn("relative inline-flex h-1.5 w-1.5 rounded-full", 
            status?.match(/active|running|healthy|positive|sent|reviewed/) ? "bg-emerald-500" :
            status?.match(/error|failed|bounced|unsubscribed|negative|spam|unhealthy/) ? "bg-rose-500" :
            status?.match(/paused|stopped|pending|degraded|pending_review/) ? "bg-amber-500" :
            status?.match(/auto_reply|ooo/) ? "bg-purple-500" :
            "bg-muted-foreground"
          )} />
        </span>
      )}
      {displayLabel}
    </div>
  );
}
