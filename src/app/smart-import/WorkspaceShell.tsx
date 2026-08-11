"use client";

import React, { useEffect } from "react";
import { useImport } from "@/components/providers/ImportProvider";
import { SupportedFormats } from "@/components/smart-import/SupportedFormats";
import { ImportDropZone } from "@/components/smart-import/ImportDropZone";
import { ImportSummary } from "@/components/smart-import/ImportSummary";
import { ImportPreviewTable } from "@/components/smart-import/ImportPreviewTable";
import { ManualMappingWorkspace } from "@/components/smart-import/ManualMappingWorkspace";
import { CampaignPlanningWizard } from "@/components/smart-import/CampaignPlanningWizard";
import { SequencePreviewWorkspace } from "@/components/smart-import/SequencePreviewWorkspace";
import { SchedulingPreviewWorkspace } from "@/components/smart-import/SchedulingPreviewWorkspace";
import { ImportHistoryWorkspace } from "@/components/smart-import/ImportHistoryWorkspace";
import { EnterpriseDiagnosticsPanel } from "@/components/smart-import/EnterpriseDiagnosticsPanel";
import { LiveExecutionDashboard } from "@/components/smart-import/LiveExecutionDashboard";
import { Button } from "@/components/ui/button";
import { Sparkles, Check } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function WorkspaceShell() {
  const { status, errorMessage, summary, proceedToPlanning, resetImport, closeSession, appendTargetSessionId, fastTrackAppend, lastDeletedItem, undoLastDelete, undo, canUndo } = useImport() as any; 

  // Determine if we should show a back button
  const showBackButton = status !== "IDLE" && status !== "ERROR" && status !== "EXECUTING" && status !== "SCHEDULING" && status !== "BUILDING";

  useEffect(() => {
    // Keyboard shortcuts removed as undo functionality was requested to be permanent.
  }, []);

  return (
    <div className="space-y-8 pb-20">
      
      {showBackButton && (
        <div className="flex items-center gap-2 -mb-2">
          {canUndo && (
            <Button variant="ghost" size="sm" onClick={undo} className="text-muted-foreground hover:text-foreground">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 h-4 w-4"><path d="m15 18-6-6 6-6"/></svg>
              Previous Step
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={resetImport} className="text-destructive/70 hover:text-destructive hover:bg-destructive/10 ml-auto">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 h-4 w-4"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            Cancel Import
          </Button>
        </div>
      )}
      
      {/* No Undo Toast - deletions are permanent */}
      
      {/* Error Message Display */}
      {status === "ERROR" && errorMessage && (
        <Alert variant="destructive" className="bg-destructive/5 border-destructive/20 shadow-sm">
          <AlertTitle className="font-semibold flex items-center gap-2">Import Failed</AlertTitle>
          <AlertDescription className="mt-2 text-sm">{errorMessage}</AlertDescription>
        </Alert>
      )}
      
      {/* Universal Prompt Helper */}
      {(status === "IDLE" || status === "ERROR") && (
        <Alert className="bg-primary/5 border-primary/20 shadow-sm">
          <Sparkles className="h-4 w-4 text-primary" />
          <AlertTitle className="text-primary font-semibold">Messy Data?</AlertTitle>
          <AlertDescription className="text-muted-foreground mt-1 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <span>Use our Universal Formatting Prompt in ChatGPT or Claude to instantly clean your raw leads into our supported format before uploading.</span>
            <Button variant="outline" size="sm" className="shrink-0 bg-background" onClick={() => {
              navigator.clipboard.writeText(`You are a professional data normalization engine. Transform the following raw lead data into a production-ready CSV using exactly these headers: Email, First Name, Last Name, Company.
Rules:
Extract only valid lead information.
Validate email syntax; discard rows with invalid emails.
Remove duplicate records using email as the unique identifier.
Normalize names to Proper Case.
Trim extra spaces and remove unnecessary punctuation.
Keep company names exactly as provided unless obvious formatting cleanup is needed.
Never fabricate missing information; leave missing fields blank.
Preserve row order whenever possible.
Return only the CSV content with the required headers. No markdown, explanations, comments, or extra text.`);
            }}>
              Copy Formatting Prompt
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Import History */}
      {(status === "IDLE" || status === "ERROR") && (
        <ImportHistoryWorkspace />
      )}

      {/* Main Drop Zone */}
      {(status === "IDLE" || status === "PARSING" || status === "VALIDATING" || status === "ERROR") && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <ImportDropZone />
          </div>
          <div className="lg:col-span-1">
            <SupportedFormats />
          </div>
        </div>
      )}

      {/* Manual Mapping Workspace */}
      {status === "MAPPING" && (
        <ManualMappingWorkspace />
      )}

      {/* Review Section */}
      {status === "REVIEW" && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <ImportDropZone />
          <ImportSummary />
          <ImportPreviewTable />
          
          <div className="flex items-center justify-end pt-4 border-t border-border gap-4">
            {summary && summary.validRows === 0 && (
              <span className="text-sm text-destructive font-medium mr-auto">
                Cannot proceed: No valid records found. Please map an Email column or upload a valid file.
              </span>
            )}
            <Button 
              disabled={!summary || summary.validRows === 0}
              onClick={() => {
                if (appendTargetSessionId && fastTrackAppend) {
                  fastTrackAppend();
                } else {
                  proceedToPlanning();
                }
              }} 
              className="gap-2 shadow-md"
            >
              <Check className="h-4 w-4" />
              {appendTargetSessionId ? "Fast-Track Append to Campaign" : "Proceed to Campaign Planning"}
            </Button>
          </div>
        </div>
      )}

      {/* Campaign Planning Wizard */}
      {status === "PLANNING" && (
        <CampaignPlanningWizard />
      )}

      {/* Building Sequences Loading State */}
      {status === "BUILDING" && (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="text-muted-foreground animate-pulse">Constructing Enterprise Sequence Blueprints...</p>
        </div>
      )}

      {/* Sequence Preview Workspace */}
      {status === "PREVIEW" && (
        <SequencePreviewWorkspace />
      )}

      {/* Compiling Schedule Loading State */}
      {status === "SCHEDULING" && (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="text-muted-foreground animate-pulse">Compiling Deterministic Execution Plan...</p>
        </div>
      )}

      {/* Success State (Block 1 boundary) */}
      {status === "APPROVED" && (
        <SchedulingPreviewWorkspace />
      )}

      {/* Live Execution Dashboard */}
      {(status === "EXECUTING" || status === "COMPLETED") && (
        <LiveExecutionDashboard />
      )}

    </div>
  );
}
