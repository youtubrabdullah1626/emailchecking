import React from "react";
import { Send, MailOpen, MessageSquareReply, ShieldCheck } from "lucide-react";
import { ClientReportMetrics } from "@/lib/reports/types";

interface ClientReportCardsProps {
  metrics: ClientReportMetrics;
}

export function ClientReportCards({ metrics }: ClientReportCardsProps) {
  const cards = [
    {
      title: "CONTACTED",
      value: metrics.totalContacted.toLocaleString(),
      subtext: `${metrics.deliveryRate}% Delivered`,
      icon: Send,
      iconColor: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-500/10 border-blue-500/20",
    },
    {
      title: "OPENED",
      value: metrics.totalOpened.toLocaleString(),
      subtext: `${metrics.openRate}% Open Rate`,
      icon: MailOpen,
      iconColor: "text-purple-600 dark:text-purple-400",
      bgColor: "bg-purple-500/10 border-purple-500/20",
    },
    {
      title: "REAL REPLIES",
      value: metrics.realReplies.toLocaleString(),
      subtext: `${metrics.replyRate}% Response Rate`,
      icon: MessageSquareReply,
      iconColor: "text-emerald-600 dark:text-emerald-400",
      bgColor: "bg-emerald-500/10 border-emerald-500/20",
    },
    {
      title: "DOMAIN HEALTH",
      value: `${metrics.domainHealth}%`,
      subtext: metrics.bounces === 0 ? "0 Bounces (Healthy)" : `${metrics.bounces} Bounces`,
      icon: ShieldCheck,
      iconColor: "text-emerald-600 dark:text-emerald-400",
      bgColor: "bg-emerald-500/10 border-emerald-500/20",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-5 print-avoid-break">
      {cards.map((card, idx) => (
        <div
          key={idx}
          className="bg-card border border-border/80 rounded-2xl p-5 md:p-6 shadow-xs flex flex-col justify-between relative overflow-hidden transition-all duration-200"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              {card.title}
            </span>
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center border ${card.bgColor} ${card.iconColor}`}
            >
              <card.icon className="w-4 h-4" />
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-2xl md:text-3xl font-black text-foreground tracking-tight">
              {card.value}
            </span>
            <p className="text-xs font-medium text-muted-foreground">
              {card.subtext}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
