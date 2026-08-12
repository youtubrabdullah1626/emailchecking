import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui";
import { AuditLogEvent } from "./types";
import { StatusBadge, ActionBadge } from "./badges";
import { Clock, Monitor, ChevronRight, MoreHorizontal, AlertCircle } from "lucide-react";

interface AuditDataTableProps {
  logs: AuditLogEvent[];
  onRowClick: (log: AuditLogEvent) => void;
  isLoading?: boolean;
  isRefreshing?: boolean;
}

export function AuditDataTable({ logs, onRowClick, isLoading = false, isRefreshing = false }: AuditDataTableProps) {
  if (isLoading) {
    return (
      <div className="p-8 text-center text-muted-foreground animate-pulse">
        Loading activities...
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="p-12 text-center flex flex-col items-center justify-center">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
          <span className="text-2xl opacity-50">🔍</span>
        </div>
        <h3 className="text-lg font-medium text-foreground mb-1">No activities found</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          Try adjusting your search or filters to find what you&apos;re looking for.
        </p>
      </div>
    );
  }

  return (
    <div className={`overflow-x-auto w-full transition-opacity duration-200 ${isRefreshing ? "opacity-60 pointer-events-none" : "opacity-100"}`}>
      <Table>
        <TableHeader className="bg-slate-50/80 border-b border-border">
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[180px] text-[11px] font-semibold text-slate-500 uppercase tracking-wider py-4">Time</TableHead>
            <TableHead className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider py-4">User / System</TableHead>
            <TableHead className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider py-4">Action</TableHead>
            <TableHead className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider py-4">Affected Area</TableHead>
            <TableHead className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider py-4">Status</TableHead>
            <TableHead className="hidden md:table-cell text-[11px] font-semibold text-slate-500 uppercase tracking-wider py-4">IP Address</TableHead>
            <TableHead className="w-[50px] text-[11px] font-semibold text-slate-500 uppercase tracking-wider py-4 text-center">Details</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((log) => {
            const date = new Date(log.time);
            const dateString = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
            const timeString = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
            
            return (
              <TableRow 
                key={log.id} 
                className={`cursor-pointer group transition-colors hover:bg-muted/50 ${
                  log.severity === 'CRITICAL' ? 'bg-destructive/5' : 
                  log.severity === 'WARNING' ? 'bg-orange-500/5' : ''
                }`}
                onClick={() => onRowClick(log)}
              >
                <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                  {dateString}, {timeString}
                </TableCell>
                <TableCell>
                  <span className="text-[14px] font-medium text-slate-700">{log.actorName || "System"}</span>
                </TableCell>
                <TableCell>
                  <ActionBadge action={log.action} category={log.category} />
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="text-[14px] text-slate-700">{log.resourceType || log.category}</span>
                    {log.resourceId && (
                      <span className="text-[14px] text-slate-500">({log.resourceId})</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <StatusBadge status={log.status} />
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <span className="text-sm text-muted-foreground">{log.ipAddress || "—"}</span>
                </TableCell>
                <TableCell>
                  <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
