"use client";

import { usePlatformFlags } from "../../hooks/usePlatformFlags";
import { ApiFeatureFlag, formatRollout } from "../../hooks/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";

interface RolloutsTabProps {
  onSelect: (item: ApiFeatureFlag) => void;
}

export function RolloutsTab({ onSelect }: RolloutsTabProps) {
  const { flags, isLoading, error } = usePlatformFlags();
  const rollouts = flags.filter((f) => f.rollout_strategy !== "GLOBAL");

  if (isLoading) {
    return (
      <div className="space-y-6 pb-10 animate-pulse">
        <div className="border border-border rounded-lg bg-background overflow-hidden">
          <div className="bg-muted/30 h-10" />
          {[1, 2].map((i) => (
            <div key={i} className="px-4 py-4 border-t border-border flex gap-6">
              <div className="h-4 bg-slate-100 rounded w-40" />
              <div className="h-4 bg-slate-100 rounded w-28" />
              <div className="h-4 bg-slate-100 rounded w-24" />
              <div className="h-4 bg-slate-100 rounded w-16 ml-auto" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-8 text-center">
        <p className="text-sm font-medium text-red-700">Failed to load rollouts</p>
        <p className="text-xs text-red-500 mt-1">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      <div className="border border-border rounded-lg bg-background overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[300px] text-xs font-semibold text-slate-500 uppercase tracking-wider h-10">
                Feature
              </TableHead>
              <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider h-10">
                Audience
              </TableHead>
              <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider h-10">
                Rollout Type
              </TableHead>
              <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider h-10 text-right">
                Status
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rollouts.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="h-24 text-center text-muted-foreground text-sm"
                >
                  No active staged rollouts. All features use global rollout.
                </TableCell>
              </TableRow>
            ) : (
              rollouts.map((rollout) => (
                <TableRow
                  key={rollout.id}
                  onClick={() => onSelect(rollout)}
                  className="cursor-pointer group transition-colors hover:bg-muted/40"
                >
                  <TableCell className="font-medium text-[13px] text-foreground">
                    {rollout.name}
                  </TableCell>
                  <TableCell className="text-[13px] text-muted-foreground">
                    {rollout.rollout_strategy === "PERCENTAGE" && rollout.rollout_percent !== null
                      ? `${rollout.rollout_percent}% of users`
                      : "Selected Audience"}
                  </TableCell>
                  <TableCell>
                    <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded text-[11px] font-medium border border-purple-200/50">
                      {formatRollout(rollout)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <StatusBadge
                      status={rollout.enabled ? "active" : "neutral"}
                      label={rollout.enabled ? "Enabled" : "Disabled"}
                      dot={rollout.enabled}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
