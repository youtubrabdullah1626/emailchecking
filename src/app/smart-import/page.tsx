import React from "react";
import { ImportProvider } from "@/components/providers/ImportProvider";
import { AnimatedPage } from "@/components/ui/animated";
import { PageHeader } from "@/components/ui/page-header";
import { SupportedFormats } from "@/components/smart-import/SupportedFormats";
import { ImportDropZone } from "@/components/smart-import/ImportDropZone";
import { ImportSummary } from "@/components/smart-import/ImportSummary";
import { ImportPreviewTable } from "@/components/smart-import/ImportPreviewTable";
import { WorkspaceShell } from "./WorkspaceShell";

import { WarmupProvider } from "@/components/providers/WarmupProvider";

export const metadata = {
  title: "Smart Import | Silaer",
};

export default function SmartImportPage() {
  return (
    <AnimatedPage>
      <div className="flex flex-col h-full bg-muted/10 min-h-[calc(100vh-4rem)] p-8">
        <PageHeader 
          title="Smart Lead Import" 
          description="Upload and format your raw prospects into enterprise campaigns automatically." 
        />
        
        <div className="mt-8 max-w-6xl mx-auto w-full">
          <WarmupProvider>
            <ImportProvider>
              <WorkspaceShell />
            </ImportProvider>
          </WarmupProvider>
        </div>
      </div>
    </AnimatedPage>
  );
}
