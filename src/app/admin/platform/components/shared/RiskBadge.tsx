import { cn } from "@/lib/utils";
import { RiskLevel } from "../../hooks/types";

// Map backend risk levels to display styles
const RISK_CONFIG: Record<RiskLevel, { label: string; className: string }> = {
  SAFE: {
    label: "Safe",
    className: "bg-slate-100 text-slate-600",
  },
  WARNING: {
    label: "Warning",
    className: "bg-amber-50 text-amber-700 border border-amber-200/50",
  },
  RESTRICTED: {
    label: "Restricted",
    className: "bg-red-50 text-red-700 border border-red-200/50",
  },
};

export function RiskBadge({ level }: { level: RiskLevel }) {
  const config = RISK_CONFIG[level];
  if (!config) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium",
        config.className
      )}
    >
      {config.label}
    </span>
  );
}
