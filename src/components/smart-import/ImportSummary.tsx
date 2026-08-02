"use client";

import React from "react";
import { useImport } from "@/components/providers/ImportProvider";
import { Card, CardContent } from "@/components/ui/card";
import { Users, CheckCircle, XCircle, AlertTriangle, Copy } from "lucide-react";

export function ImportSummary() {
  const { summary } = useImport();

  if (!summary) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      <Card className="border-border shadow-sm">
        <CardContent className="p-4 flex flex-col gap-1">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Users className="h-4 w-4" />
            <span className="text-xs font-medium">Total Rows</span>
          </div>
          <span className="text-2xl font-semibold text-foreground">{summary.totalRows}</span>
        </CardContent>
      </Card>
      
      <Card className="border-border shadow-sm">
        <CardContent className="p-4 flex flex-col gap-1">
          <div className="flex items-center gap-2 text-emerald-500 mb-2">
            <CheckCircle className="h-4 w-4" />
            <span className="text-xs font-medium">Valid Records</span>
          </div>
          <span className="text-2xl font-semibold text-foreground">{summary.validRows}</span>
        </CardContent>
      </Card>

      <Card className="border-border shadow-sm">
        <CardContent className="p-4 flex flex-col gap-1">
          <div className="flex items-center gap-2 text-destructive mb-2">
            <XCircle className="h-4 w-4" />
            <span className="text-xs font-medium">Invalid Records</span>
          </div>
          <span className="text-2xl font-semibold text-foreground">{summary.invalidRows}</span>
        </CardContent>
      </Card>

      <Card className="border-border shadow-sm">
        <CardContent className="p-4 flex flex-col gap-1">
          <div className="flex items-center gap-2 text-blue-500 mb-2">
            <Copy className="h-4 w-4" />
            <span className="text-xs font-medium">Duplicates</span>
          </div>
          <span className="text-2xl font-semibold text-foreground">{summary.duplicateRows}</span>
        </CardContent>
      </Card>

      <Card className="border-border shadow-sm">
        <CardContent className="p-4 flex flex-col gap-1">
          <div className="flex items-center gap-2 text-amber-500 mb-2">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-xs font-medium">Warnings</span>
          </div>
          <span className="text-2xl font-semibold text-foreground">{summary.warnings}</span>
        </CardContent>
      </Card>
    </div>
  );
}
