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
  
  // Dynamically extract which standard and custom fields have any data
  const customFieldKeys = new Set<string>();
  const standardFieldKeys = new Set<string>();
  
  const allStandardKeys = ['firstName', 'lastName', 'companyName', 'title', 'linkedinProfile', 'phone', 'website', 'country', 'city'];
  
  // Always show these three even if empty, as they are core
  const coreKeys = ['firstName', 'lastName', 'companyName'];
  coreKeys.forEach(k => standardFieldKeys.add(k));

  records.forEach((r: any) => {
    allStandardKeys.forEach(k => {
      if (r[k] !== undefined && r[k] !== null && r[k] !== '') {
        standardFieldKeys.add(k);
      }
    });
    
    if (r.customFields) {
      Object.keys(r.customFields).forEach(k => {
        customFieldKeys.add(k);
      });
    }
  });

  const activeStandardCols = allStandardKeys.filter(k => standardFieldKeys.has(k));
  const activeCustomCols = Array.from(customFieldKeys).sort();

  const formatCamelCase = (str: string) => {
    return str.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();
  };

  return (
    <Card className="border-border shadow-sm overflow-hidden">
      <CardHeader className="bg-muted/5 border-b border-border">
        <CardTitle className="text-base font-semibold">Data Preview</CardTitle>
        <CardDescription>Reviewing the first 20 records. Please ensure columns map correctly.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="w-full max-h-[400px]">
          <div className="min-w-max">
            <Table>
              <TableHeader className="bg-muted/30 sticky top-0 z-10 backdrop-blur-sm">
                <TableRow>
                  <TableHead className="w-[120px] sticky left-0 bg-background/95">Status</TableHead>
                  <TableHead className="sticky left-[120px] bg-background/95 shadow-[1px_0_0_0_#e2e8f0]">Email</TableHead>
                  {activeStandardCols.map(col => (
                    <TableHead key={col}>{formatCamelCase(col)}</TableHead>
                  ))}
                  {activeCustomCols.map(col => (
                    <TableHead key={col} className="text-muted-foreground">{formatCamelCase(col)}</TableHead>
                  ))}
                <TableHead className="text-right">Issues</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {previewRecords.map((row: any) => (
                <TableRow key={row.id}>
                  <TableCell className="sticky left-0 bg-background">
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
                  <TableCell className="font-medium text-xs truncate max-w-[200px] sticky left-[120px] bg-background shadow-[1px_0_0_0_#e2e8f0]">
                    {row.email}
                  </TableCell>
                  {activeStandardCols.map(col => (
                    <TableCell key={col} className="text-xs text-muted-foreground truncate max-w-[150px]">
                      {row[col] || "-"}
                    </TableCell>
                  ))}
                  {activeCustomCols.map(col => (
                    <TableCell key={col} className="text-xs text-muted-foreground truncate max-w-[150px]">
                      {row.customFields?.[col] || "-"}
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
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
