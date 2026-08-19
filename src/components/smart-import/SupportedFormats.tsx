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
    <Card className="border border-border shadow-xs bg-card">
      <CardHeader>
        <CardTitle className="text-base font-bold text-foreground">Supported Formats</CardTitle>
        <CardDescription className="text-xs">Upload leads directly if they match these formats.</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3.5">
        {formats.map((f) => (
          <div key={f.ext} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-secondary/30 hover:border-border hover:bg-secondary/50 transition-all">
            <div className="p-2 bg-card rounded-md shadow-2xs border border-border text-foreground">
              {f.icon}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-foreground">{f.ext}</span>
              <span className="text-[11px] text-muted-foreground truncate">{f.desc}</span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
