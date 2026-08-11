import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui";
import { AuditLogEvent } from "./types";
import { StatusBadge, ActionBadge } from "./badges";
import { Clock, Monitor, ChevronRight, MoreHorizontal } from "lucide-react";

interface AuditDataTableProps {
  logs: AuditLogEvent[];
  onRowClick: (log: AuditLogEvent) => void;
  isLoading?: boolean;
}

export function AuditDataTable({ logs, onRowClick, isLoading = false }: AuditDataTableProps) {
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
    <div className="overflow-x-auto w-full">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[180px]">Time</TableHead>
            <TableHead>User / System</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Affected Area</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden md:table-cell">IP Address</TableHead>
            <TableHead className="w-[50px]">Details</TableHead>
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
                className="cursor-pointer group transition-colors hover:bg-muted/50"
                onClick={() => onRowClick(log)}
              >
                <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                  {dateString}, {timeString}
                </TableCell>
                <TableCell>
                  <span className="text-sm font-medium text-foreground">{log.actorName || "System"}</span>
                </TableCell>
                <TableCell>
                  <ActionBadge action={log.action} category={log.category} />
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground">{log.resourceName || "—"}</span>
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
