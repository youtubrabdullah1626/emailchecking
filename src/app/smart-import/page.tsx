import React from "react";
import { ImportProvider } from "@/components/providers/ImportProvider";
import { WorkspaceShell } from "./WorkspaceShell";
import { WarmupProvider } from "@/components/providers/WarmupProvider";
import { FileUp, Info, Sparkles } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export const metadata = {
  title: "Smart Import | Silaer",
  description: "Upload and format your raw prospects into enterprise campaigns automatically.",
};

export default function SmartImportPage() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Signature Silaer Header Banner */}
      <div className="bg-card border border-border/80 rounded-xl p-6 shadow-xs relative overflow-hidden transition-colors duration-200">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start sm:items-center gap-4">
            <div className="h-11 w-11 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
              <FileUp className="h-5 w-5" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-bold text-foreground tracking-tight">
                  Smart Lead Import
                </h1>
                <TooltipProvider>
                  <Tooltip delayDuration={200}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="flex items-center justify-center h-5 w-5 rounded-full bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-help border border-border/80"
                      >
                        <Info className="h-3 w-3" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" align="center" className="max-w-xs p-3 bg-popover border border-border shadow-md rounded-lg z-50 text-xs">
                      <p className="font-semibold text-foreground mb-1">
                        AI Data Mapping Engine
                      </p>
                      <p className="text-muted-foreground leading-relaxed">
                        Upload CSV or Excel spreadsheets. Our engine normalizes headers, validates email syntax, and prevents duplicates automatically.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
                Upload and format your raw prospects into outreach campaigns with automated column detection.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full">
        <WarmupProvider>
          <ImportProvider>
            <WorkspaceShell />
          </ImportProvider>
        </WarmupProvider>
      </div>
    </div>
  );
}
