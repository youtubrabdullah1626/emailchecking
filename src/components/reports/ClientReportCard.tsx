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
      badge: `${metrics.deliveryRate}% Delivered`,
      badgeColor: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800",
      icon: Send,
      iconColor: "text-sky-600 dark:text-sky-400",
      bgColor: "bg-sky-500/10 border-sky-500/20",
    },
    {
      title: "Opened Emails",
      value: metrics.totalOpened.toLocaleString(),
      badge: `${metrics.openRate}% Open Rate`,
      badgeColor: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800",
      icon: MailOpen,
      iconColor: "text-purple-600 dark:text-purple-400",
      bgColor: "bg-purple-500/10 border-purple-500/20",
    },
    {
      title: "Confirmed Replies",
      value: metrics.realReplies.toLocaleString(),
      badge: `${metrics.replyRate}% Response Rate`,
      badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800",
      icon: Reply,
      iconColor: "text-emerald-600 dark:text-emerald-400",
      bgColor: "bg-emerald-500/10 border-emerald-500/20",
    },
    {
      title: "Domain Health",
      value: `${metrics.domainHealth}%`,
      badge: metrics.bounces === 0 ? "0 Bounces • Clean" : `${metrics.bounces} Bounces`,
      badgeColor: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/50 dark:text-teal-300 dark:border-teal-800",
      icon: ShieldCheck,
      iconColor: "text-teal-600 dark:text-teal-400",
      bgColor: "bg-teal-500/10 border-teal-500/20",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print-avoid-break">
      {cards.map((card, idx) => (
        <div
          key={idx}
          className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between relative overflow-hidden transition-all duration-200"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {card.title}
            </span>
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center border ${card.bgColor} ${card.iconColor}`}
            >
              <card.icon className="w-4 h-4" />
            </div>
          </div>

          <div className="space-y-2 mt-1">
            <div className="text-3xl font-black text-slate-900 dark:text-white font-mono tracking-tight">
              {card.value}
            </div>
            <div className="inline-flex items-center">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${card.badgeColor}`}>
                {card.badge}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
