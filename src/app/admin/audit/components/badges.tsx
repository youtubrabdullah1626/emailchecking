import React from "react";
import { LegacyBadge as Badge } from "@/components/ui/legacy-adapters";
import { AuditStatus, ActionCategory } from "./types";
import { Clock, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

export function StatusBadge({ status }: { status: AuditStatus }) {
  const getBadgeProps = () => {
    switch (status) {
      case "Success":
        return { variant: "success" as const, icon: <Clock className="w-3 h-3 mr-1" />, label: "Success" };
      case "Failed":
        return { variant: "danger" as const, icon: <XCircle className="w-3 h-3 mr-1" />, label: "Failed" };
      case "Warning":
        return { variant: "warning" as const, icon: <AlertTriangle className="w-3 h-3 mr-1" />, label: "Warning" };
      case "Pending":
      default:
        return { variant: "info" as const, icon: <Clock className="w-3 h-3 mr-1" />, label: "Pending" };
    }
  };

  const props = getBadgeProps();
  
  // Premium soft-tinted badges
  return (
    <div className={`inline-flex items-center whitespace-nowrap px-2.5 py-1 rounded-md text-[11px] font-semibold tracking-wide border ${
      props.variant === 'info' ? 'bg-slate-50 text-slate-600 border-slate-200/60' :
      props.variant === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60' :
      props.variant === 'danger' ? 'bg-red-50 text-red-700 border-red-200/60' :
      'bg-amber-50 text-amber-700 border-amber-200/60'
    }`}>
      {props.icon}
      {status === "Pending" ? "PENDING" : status.toUpperCase()} 
    </div>
  );
}

// Convert "PLATFORM_CONFIG_UPDATED" to "Platform Config Updated"
function formatAction(action: string | undefined | null) {
  if (!action) return "Unknown Action";
  return action
    .split("_")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export function ActionBadge({ action, category }: { action: string, category: ActionCategory | string }) {
  const formattedAction = formatAction(action);
  
  // Choose color based on keywords to match screenshot (e.g. Config updated = yellow, Login = blue)
  let colorClass = "bg-slate-100 text-slate-700";
  
  const lower = formattedAction.toLowerCase();
  if (lower.includes("update") || lower.includes("config") || lower.includes("edit")) {
    colorClass = "bg-amber-100 text-amber-800";
  } else if (lower.includes("login") || lower.includes("approve") || lower.includes("create") || lower.includes("start")) {
    colorClass = "bg-blue-100 text-blue-700";
  } else if (lower.includes("delete") || lower.includes("remove") || lower.includes("stop")) {
    colorClass = "bg-red-100 text-red-700";
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-semibold tracking-wide ${colorClass}`}>
      {formattedAction}
    </span>
  );
}
