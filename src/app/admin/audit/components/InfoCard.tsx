import React from "react";

export function MetadataGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {children}
    </div>
  );
}

export function InfoCard({ label, value, monospace = false }: { label: string; value: React.ReactNode; monospace?: boolean }) {
  return (
    <div className="flex flex-col gap-1 p-3 bg-muted/30 rounded-md border border-border">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
      <span className={`text-sm text-foreground break-all ${monospace ? "font-mono" : ""}`}>
        {value || "—"}
      </span>
    </div>
  );
}
