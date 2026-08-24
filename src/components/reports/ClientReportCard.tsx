import React from "react";
import { Send, MailOpen, Reply, ShieldCheck } from "lucide-react";
import { ClientReportMetrics } from "@/lib/reports/types";

interface ClientReportCardsProps {
  metrics: ClientReportMetrics;
}

export function ClientReportCards({ metrics }: ClientReportCardsProps) {
  const cards = [
    {
      title: "Contacted Leads",
      value: metrics.totalContacted.toLocaleString(),
      subtext: `${metrics.deliveryRate}% Delivered`,
      icon: Send,
    },
    {
      title: "Opened Emails",
      value: metrics.totalOpened.toLocaleString(),
      subtext: `${metrics.openRate}% Open Rate`,
      icon: MailOpen,
    },
    {
      title: "Confirmed Replies",
      value: metrics.realReplies.toLocaleString(),
      subtext: `${metrics.replyRate}% Response Rate`,
      icon: Reply,
    },
    {
      title: "Domain Health",
      value: `${metrics.domainHealth}%`,
      subtext: metrics.bounces === 0 ? "0 Bounces" : `${metrics.bounces} Bounces`,
      icon: ShieldCheck,
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 print-avoid-break">
      {cards.map((card, idx) => (
        <div
          key={idx}
          className="bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl p-4 md:p-5 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {card.title}
            </span>
            <card.icon className="w-4 h-4 text-slate-400 dark:text-slate-500" />
          </div>

          <div className="space-y-1">
            <div className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white font-mono tracking-tight">
              {card.value}
            </div>
            <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
              {card.subtext}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
