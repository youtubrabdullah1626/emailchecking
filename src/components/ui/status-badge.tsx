import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const statusBadgeVariants = cva(
  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium tracking-tight transition-colors border",
  {
    variants: {
      status: {
        active: "bg-emerald-50 text-emerald-700 border-emerald-200",
        running: "bg-emerald-50 text-emerald-700 border-emerald-200",
        healthy: "bg-emerald-50 text-emerald-700 border-emerald-200",
        positive: "bg-emerald-50 text-emerald-700 border-emerald-200",
        keep_active: "bg-emerald-50 text-emerald-700 border-emerald-200",
        completed: "bg-blue-50 text-blue-700 border-blue-200",
        paused: "bg-amber-50 text-amber-700 border-amber-200",
        stopped: "bg-amber-50 text-amber-700 border-amber-200",
        neutral: "bg-gray-100 text-gray-700 border-gray-200",
        idle: "bg-gray-100 text-gray-700 border-gray-200",
        none: "bg-gray-100 text-gray-700 border-gray-200",
        pending: "bg-gray-100 text-gray-700 border-gray-200",
        pending_review: "bg-amber-50 text-amber-700 border-amber-200",
        bounced: "bg-red-50 text-red-700 border-red-200",
        unsubscribed: "bg-red-50 text-red-700 border-red-200",
        failed: "bg-red-50 text-red-700 border-red-200",
        error: "bg-red-50 text-red-700 border-red-200",
        unhealthy: "bg-red-50 text-red-700 border-red-200",
        negative: "bg-red-50 text-red-700 border-red-200",
        stop_sequence: "bg-red-50 text-red-700 border-red-200",
        degraded: "bg-amber-50 text-amber-700 border-amber-200",
        auto_reply: "bg-purple-50 text-purple-700 border-purple-200",
        ooo: "bg-purple-50 text-purple-700 border-purple-200",
        spam: "bg-red-50 text-red-700 border-red-200",
        dismissed: "bg-gray-100 text-gray-700 border-gray-200",
        auto_processed: "bg-blue-50 text-blue-700 border-blue-200",
        reviewed: "bg-emerald-50 text-emerald-700 border-emerald-200",
        unknown: "bg-gray-100 text-gray-700 border-gray-200",
        sent: "bg-emerald-50 text-emerald-700 border-emerald-200",
        skipped: "bg-gray-100 text-gray-700 border-gray-200",
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
            status?.match(/active|running|healthy|positive/) ? "bg-emerald-500" :
            status?.match(/error|failed|bounced|unsubscribed|negative|spam|unhealthy/) ? "bg-red-500" :
            status?.match(/paused|stopped|pending|degraded/) ? "bg-amber-500" :
            "bg-gray-400"
          )} />
        </span>
      )}
      {displayLabel}
    </div>
  );
}
