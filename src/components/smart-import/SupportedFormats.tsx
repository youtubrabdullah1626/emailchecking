import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LegacyBadge as Badge } from "@/components/ui/legacy-adapters";
import { FileText, Table, FileJson, FileSpreadsheet } from "lucide-react";

export function SupportedFormats() {
  const formats = [
    { ext: "CSV", icon: <FileText className="h-4 w-4" />, desc: "Comma separated values" },
    { ext: "XLSX", icon: <FileSpreadsheet className="h-4 w-4" />, desc: "Excel spreadsheet" },
    { ext: "PDF", icon: <Table className="h-4 w-4" />, desc: "Table-based PDF" },
    { ext: "JSON", icon: <FileJson className="h-4 w-4" />, desc: "JSON array" },
  ];

  return (
    <Card className="border-border shadow-sm">
      <CardHeader>
        <CardTitle className="text-base font-semibold">Supported Formats</CardTitle>
        <CardDescription>Upload leads directly if they match these formats.</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-4">
        {formats.map((f) => (
          <div key={f.ext} className="flex items-center gap-3 p-3 rounded-md border border-border/50 bg-muted/10">
            <div className="p-2 bg-background rounded-md shadow-sm border border-border/50 text-muted-foreground">
              {f.icon}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium">{f.ext}</span>
              <span className="text-xs text-muted-foreground">{f.desc}</span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
