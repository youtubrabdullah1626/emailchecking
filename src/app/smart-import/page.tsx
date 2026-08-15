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
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Signature Silaer Warm Header Banner */}
      <div className="bg-gradient-to-r from-orange-100/70 via-amber-50/60 to-white dark:from-slate-900 dark:via-slate-900 dark:to-slate-800/80 border border-orange-200/80 dark:border-orange-950/40 rounded-2xl p-5 md:p-6 shadow-xs relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start sm:items-center gap-4">
            <div className="h-11 w-11 rounded-full bg-orange-100 dark:bg-orange-950/70 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0 border border-orange-200/80 dark:border-orange-800/50 shadow-xs">
              <FileUp className="h-5 w-5" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                  Smart Lead Import
                </h1>
                <TooltipProvider>
                  <Tooltip delayDuration={200}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="flex items-center justify-center h-5 w-5 rounded-full bg-orange-100/80 text-orange-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-orange-200 transition-colors cursor-help"
                      >
                        <Info className="h-3 w-3" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" align="center" className="max-w-xs p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl rounded-xl z-50 text-xs">
                      <p className="font-semibold text-slate-900 dark:text-white mb-1">
                        AI Data Mapping Engine
                      </p>
                      <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                        Upload CSV or Excel spreadsheets. Our engine normalizes headers, validates email syntax, and prevents duplicates automatically.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 mt-0.5">
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
