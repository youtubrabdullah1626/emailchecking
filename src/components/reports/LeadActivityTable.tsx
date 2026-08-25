import React from "react";
import { ReportLeadActivity } from "@/lib/reports/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

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
            Lead Activity & Delivery History
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Verified delivery tracking across all connected inboxes
          </p>
        </div>
        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-md">
          {activities.length} {activities.length === 1 ? "Lead" : "Leads"} Audited
        </span>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900 shadow-2xs">
        <Table>
          <TableHeader className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800">
            <TableRow className="hover:bg-transparent">
              <TableHead className="py-2.5 text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                Recipient
              </TableHead>
              <TableHead className="py-2.5 text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                Sending Inbox
              </TableHead>
              <TableHead className="py-2.5 text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                Lead Timezone
              </TableHead>
              <TableHead className="py-2.5 text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                Dispatched
              </TableHead>
              <TableHead className="py-2.5 text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                Opened
              </TableHead>
              <TableHead className="py-2.5 text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                Replied
              </TableHead>
              <TableHead className="py-2.5 text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider text-right">
                Status
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
            {activities.map((act) => (
              <TableRow key={act.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                {/* Recipient */}
                <TableCell className="py-2.5 font-semibold text-slate-900 dark:text-white">
                  {act.recipientEmail}
                </TableCell>

                {/* Sending Inbox */}
                <TableCell className="py-2.5 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                  {act.senderInbox}
                </TableCell>

                {/* Lead Timezone */}
                <TableCell className="py-2.5 text-slate-600 dark:text-slate-300">
                  {act.leadTimezone}
                </TableCell>

                {/* Dispatched At */}
                <TableCell className="py-2.5 text-slate-700 dark:text-slate-300">
                  {act.dispatchedAt || "—"}
                </TableCell>

                {/* Opened At */}
                <TableCell className="py-2.5 text-slate-700 dark:text-slate-300">
                  {act.openedAt ? (
                    <span>
                      {act.openedAt}
                      {act.openCount > 1 && (
                        <span className="text-[10px] text-slate-500 font-semibold ml-1">
                          ({act.openCount}x)
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </TableCell>

                {/* Replied At */}
                <TableCell className="py-2.5 text-slate-700 dark:text-slate-300 font-medium">
                  {act.repliedAt || "—"}
                </TableCell>

                {/* Status Badge */}
                <TableCell className="py-2.5 text-right">
                  {act.status === "REPLIED" && (
                    <Badge variant="outline" className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700 text-[10px] font-semibold">
                      Replied
                    </Badge>
                  )}
                  {act.status === "OPENED" && (
                    <Badge variant="outline" className="bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 text-[10px] font-medium">
                      Opened
                    </Badge>
                  )}
                  {act.status === "SENT" && (
                    <Badge variant="outline" className="text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 text-[10px] font-medium">
                      Delivered
                    </Badge>
                  )}
                  {act.status === "SCHEDULED" && (
                    <Badge variant="outline" className="text-slate-400 border-slate-200 dark:border-slate-800 text-[10px] font-normal">
                      Scheduled
                    </Badge>
                  )}
                  {act.status === "BOUNCED" && (
                    <Badge variant="outline" className="text-slate-500 border-slate-300 text-[10px] font-medium">
                      Bounced
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
