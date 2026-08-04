import React from "react";
import { AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";
import { GlobalAnalyticsPayload } from "@/lib/analytics/analytics.service";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface ActionableAlertsProps {
  data?: GlobalAnalyticsPayload | null;
  isLoading?: boolean;
}

export function ActionableAlerts({ data, isLoading }: ActionableAlertsProps) {
  if (isLoading || !data) return null;

  const alerts = [];

  // Logic 1: High Bounce Rate (Reputation Risk)
  const bounceRate = data.emails?.rates?.bounce ?? 0;
  if (bounceRate > 10) {
    alerts.push({
      id: 1,
      type: "destructive",
      icon: <ShieldAlert className="h-4 w-4" />,
      title: "High Global Bounce Rate",
      message: `Your global bounce rate is currently ${bounceRate}%. This risks your server's email reputation. Please check the Active Users page and suspend users with high bounce rates immediately.`,
    });
  }

  // Logic 2: System Health (Server/Storage)
  const onlineUsers = data.platform?.onlineUsers ?? 0;
  const storageUsed = data.storage?.totalUsedGb ?? 0;
  
  if (onlineUsers > 450) {
    alerts.push({
      id: 2,
      type: "warning",
      icon: <AlertTriangle className="h-4 w-4" />,
      title: "Server Nearing Capacity",
      message: "You have a very high number of active users right now. Keep an eye on website speed.",
    });
  }

  if (storageUsed > 8) {
    alerts.push({
      id: 3,
      type: "warning",
      icon: <AlertTriangle className="h-4 w-4" />,
      title: "Storage Warning",
      message: "Database storage is over 80% full. Consider upgrading soon to prevent data loss.",
    });
  }

  // If everything is perfect
  if (alerts.length === 0) {
    return (
      <Alert className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        <AlertTitle>All Systems Nominal</AlertTitle>
        <AlertDescription>
          No critical action items today. Your platform, server, and users are performing perfectly.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-3">
      {alerts.map((alert) => (
        <Alert key={alert.id} variant={alert.type as any}>
          {alert.icon}
          <AlertTitle>{alert.title}</AlertTitle>
          <AlertDescription>{alert.message}</AlertDescription>
        </Alert>
      ))}
    </div>
  );
}
