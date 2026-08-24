import React from "react";
import { ReportLeadActivity } from "@/lib/reports/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Mail, Clock, Send, Eye, MessageSquareReply, Globe, ShieldCheck } from "lucide-react";

interface LeadActivityTableProps {
  activities: ReportLeadActivity[];
}

export function LeadActivityTable({ activities }: LeadActivityTableProps) {
  if (!activities || activities.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 pt-2 print-avoid-break">
      <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-sm md:text-base font-bold text-slate-900 dark:text-white tracking-tight">
            Outbound Activity & Lead Journey Audit
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Real-time telemetry recorded across all connected inboxes
          </p>
        </div>
        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-md">
          {activities.length} {activities.length === 1 ? "Lead" : "Leads"} Audited
        </span>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900 shadow-2xs">
        <Table>
          <TableHeader className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800">
            <TableRow className="hover:bg-transparent">
              <TableHead className="py-3 text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                Recipient
              </TableHead>
              <TableHead className="py-3 text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                Sending Inbox
              </TableHead>
              <TableHead className="py-3 text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                Lead Timezone
              </TableHead>
              <TableHead className="py-3 text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                Dispatched
              </TableHead>
              <TableHead className="py-3 text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                Opened
              </TableHead>
              <TableHead className="py-3 text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                Replied
              </TableHead>
              <TableHead className="py-3 text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider text-right">
                Status
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
            {activities.map((act) => (
              <TableRow key={act.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                {/* Recipient */}
                <TableCell className="py-3 font-semibold text-slate-900 dark:text-white">
                  {act.recipientEmail}
                </TableCell>

                {/* Sending Inbox */}
                <TableCell className="py-3 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                  {act.senderInbox}
                </TableCell>

                {/* Lead Timezone */}
                <TableCell className="py-3 text-slate-500 dark:text-slate-400">
                  <span className="inline-flex items-center gap-1">
                    <Globe className="w-3 h-3 text-slate-400" />
                    {act.leadTimezone.replace("_", " ")}
                  </span>
                </TableCell>

                {/* Dispatched At */}
                <TableCell className="py-3 text-slate-700 dark:text-slate-300">
                  {act.dispatchedAt ? (
                    <span className="inline-flex items-center gap-1 font-medium">
                      <Send className="w-3 h-3 text-sky-500" />
                      {act.dispatchedAt}
                    </span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </TableCell>

                {/* Opened At */}
                <TableCell className="py-3 text-slate-700 dark:text-slate-300">
                  {act.openedAt ? (
                    <span className="inline-flex items-center gap-1 font-medium">
                      <Eye className="w-3 h-3 text-purple-500" />
                      {act.openedAt}
                      {act.openCount > 1 && (
                        <span className="text-[10px] text-purple-600 font-bold ml-0.5">
                          ({act.openCount}x)
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </TableCell>

                {/* Replied At */}
                <TableCell className="py-3">
                  {act.repliedAt ? (
                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                      <MessageSquareReply className="w-3.5 h-3.5" />
                      {act.repliedAt}
                    </span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </TableCell>

                {/* Status Badge */}
                <TableCell className="py-3 text-right">
                  {act.status === "REPLIED" && (
                    <Badge className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 text-[10px] font-bold">
                      🟢 Replied
                    </Badge>
                  )}
                  {act.status === "OPENED" && (
                    <Badge className="bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800 text-[10px] font-bold">
                      🟣 Opened
                    </Badge>
                  )}
                  {act.status === "SENT" && (
                    <Badge className="bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border-sky-200 dark:border-sky-800 text-[10px] font-bold">
                      🔵 Delivered
                    </Badge>
                  )}
                  {act.status === "SCHEDULED" && (
                    <Badge variant="outline" className="text-slate-500 border-slate-200 dark:border-slate-800 text-[10px] font-medium">
                      ⏱️ Scheduled
                    </Badge>
                  )}
                  {act.status === "BOUNCED" && (
                    <Badge className="bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 text-[10px] font-bold">
                      🔴 Bounced
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
