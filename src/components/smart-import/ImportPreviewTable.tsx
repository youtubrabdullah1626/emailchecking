"use client";

import React from "react";
import { useImport } from "@/components/providers/ImportProvider";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LegacyBadge as Badge } from "@/components/ui/legacy-adapters";
import { AlertCircle, CheckCircle2 } from "lucide-react";

export function ImportPreviewTable() {
  const { getRecords } = useImport() as any;
  const records = getRecords();

  if (!records || records.length === 0) return null;

  const previewRecords = records.slice(0, 20);
  
  // Dynamically extract follow-up columns detected in the import
  const customFieldKeys = new Set<string>();
  records.forEach((r: any) => {
    Object.keys(r.customFields).forEach(k => {
      if (k.toLowerCase().includes("followup") || k.toLowerCase().includes("follow-up")) {
         customFieldKeys.add(k);
      }
    });
  });
  const followUpColumns = Array.from(customFieldKeys).sort();

  return (
    <Card className="border-border shadow-sm overflow-hidden">
      <CardHeader className="bg-muted/5 border-b border-border">
        <CardTitle className="text-base font-semibold">Data Preview</CardTitle>
        <CardDescription>Reviewing the first 20 records. Please ensure columns map correctly.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="w-full max-h-[400px]">
          <Table>
            <TableHeader className="bg-muted/30 sticky top-0 z-10 backdrop-blur-sm">
              <TableRow>
                <TableHead className="w-[120px]">Status</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>First Name</TableHead>
                <TableHead>Last Name</TableHead>
                <TableHead>Company</TableHead>
                {followUpColumns.map(col => (
                  <TableHead key={col} className="capitalize">{col.replace(/([A-Z])/g, ' $1').trim()}</TableHead>
                ))}
                <TableHead className="text-right">Issues</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {previewRecords.map((row: any) => (
                <TableRow key={row.id}>
                  <TableCell>
                    {row.isValid && !row.isDuplicate ? (
                      <div className="flex items-center gap-1.5 text-emerald-500">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span className="text-xs font-medium">Valid</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-destructive">
                        <AlertCircle className="h-3.5 w-3.5" />
                        <span className="text-xs font-medium">
                          {row.isDuplicate ? "Duplicate" : "Invalid"}
                        </span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium text-xs truncate max-w-[200px]">
                    {row.email}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{row.firstName || "-"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{row.lastName || "-"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{row.companyName || "-"}</TableCell>
                  {followUpColumns.map(col => (
                    <TableCell key={col} className="text-xs text-muted-foreground truncate max-w-[150px]">
                      {row.customFields[col] || "-"}
                    </TableCell>
                  ))}
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1 flex-wrap">
                      {row.errors.map((err: string, i: number) => (
                        <Badge key={`err-${i}`} variant="danger" className="text-[10px] py-0">{err}</Badge>
                      ))}
                      {row.warnings.map((warn: string, i: number) => (
                        <Badge key={`warn-${i}`} variant="neutral" className="text-[10px] py-0 border-amber-500/30 text-amber-600 bg-amber-500/10">{warn}</Badge>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
