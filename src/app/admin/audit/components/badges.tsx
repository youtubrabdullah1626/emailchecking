import React from "react";
import { LegacyBadge as Badge } from "@/components/ui/legacy-adapters";
import { AuditStatus, ActionCategory } from "./types";
import { Clock, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

export function StatusBadge({ status }: { status: AuditStatus }) {
  const getBadgeProps = () => {
    switch (status) {
      case "Success":
        return { variant: "success" as const, icon: <CheckCircle2 className="w-3 h-3 mr-1" />, label: "Success" };
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
  // Using custom styling to match the screenshot (very light background, colored text/border)
  return (
    <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
      props.variant === 'info' ? 'bg-blue-50 text-blue-700 border-blue-200' :
      props.variant === 'success' ? 'bg-green-50 text-green-700 border-green-200' :
      props.variant === 'danger' ? 'bg-red-50 text-red-700 border-red-200' :
      'bg-amber-50 text-amber-700 border-amber-200'
    }`}>
      {props.icon}
      {status === "Pending" ? "Pending" : status} 
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
  let colorClass = "bg-slate-50 text-slate-700 border-slate-200";
  
  const lower = formattedAction.toLowerCase();
  if (lower.includes("update") || lower.includes("config") || lower.includes("edit")) {
    colorClass = "bg-amber-50 text-amber-700 border-amber-200";
  } else if (lower.includes("login") || lower.includes("approve") || lower.includes("create")) {
    colorClass = "bg-blue-50 text-blue-700 border-blue-200";
  } else if (lower.includes("delete") || lower.includes("remove")) {
    colorClass = "bg-red-50 text-red-700 border-red-200";
  } else {
    colorClass = "bg-slate-50 text-slate-700 border-slate-200"; // default
  }

  return (
    <div className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border whitespace-nowrap ${colorClass}`}>
      {formattedAction}
    </div>
  );
}
