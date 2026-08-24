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
      <WarmupProvider>
        <ImportProvider>
          <WorkspaceShell />
        </ImportProvider>
      </WarmupProvider>
    </div>
  );
}

