"use client";

import React from "react";
import { useImport } from "@/components/providers/ImportProvider";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Info, XCircle, Activity, Server, Zap, ShieldCheck } from "lucide-react";

export function EnterpriseDiagnosticsPanel() {
  const { diagnostics, performanceMetrics, status } = useImport() as any;

  if (status === "IDLE" || status === "PARSING" || status === "MAPPING") {
    return null; 
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8 animate-in fade-in slide-in-from-bottom-4">
      {/* Performance & Analytics */}
      <Card className="border-border shadow-sm">
        <CardHeader className="bg-muted/5 border-b border-border py-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Import Summary & Performance
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          {performanceMetrics ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-muted/20 rounded-md border border-border">
                  <p className="text-xs text-muted-foreground mb-1">Total Processing Time</p>
                  <p className="text-lg font-mono">{performanceMetrics.totalTimeMs.toFixed(0)} ms</p>
                </div>
                <div className="p-3 bg-muted/20 rounded-md border border-border">
                  <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                    <Server className="h-3 w-3" /> Memory Footprint (Est)
                  </p>
                  <p className="text-lg font-mono">{performanceMetrics.memoryEstimateMB.toFixed(2)} MB</p>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase text-muted-foreground">System Speed</p>
                <div className="flex justify-between text-sm">
                  <span>Reading File</span>
                  <span className="font-mono">{performanceMetrics.parsingTimeMs.toFixed(1)} ms</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Checking Data Quality</span>
                  <span className="font-mono">{(performanceMetrics.mappingTimeMs + performanceMetrics.validationTimeMs).toFixed(1)} ms</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Building Campaign</span>
                  <span className="font-mono">{performanceMetrics.sequenceGenTimeMs.toFixed(1)} ms</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Creating Schedule</span>
                  <span className="font-mono">{performanceMetrics.schedulingTimeMs.toFixed(1)} ms</span>
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-24 text-muted-foreground text-sm">
              <Zap className="h-4 w-4 mr-2 animate-pulse" />
              Collecting telemetry...
            </div>
          )}
        </CardContent>
      </Card>

      {/* Diagnostics Engine */}
      <Card className="border-border shadow-sm">
        <CardHeader className="bg-muted/5 border-b border-border py-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            Data Quality Report
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          {diagnostics && diagnostics.length > 0 ? (
            <div className="space-y-3 max-h-[250px] overflow-y-auto pr-2">
              {diagnostics.map((issue: any) => (
                <div key={issue.id} className={`p-3 border rounded-md ${
                  issue.severity === "Critical" ? "bg-red-50 border-red-200" :
                  issue.severity === "Error" ? "bg-orange-50 border-orange-200" :
                  issue.severity === "Warning" ? "bg-amber-50 border-amber-200" :
                  "bg-blue-50 border-blue-200"
                }`}>
                  <div className="flex items-start gap-2">
                    {issue.severity === "Critical" ? <XCircle className="h-4 w-4 text-red-600 mt-0.5" /> :
                     issue.severity === "Error" ? <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5" /> :
                     <Info className="h-4 w-4 text-amber-600 mt-0.5" />}
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-sm font-semibold ${
                          issue.severity === "Critical" ? "text-red-900" :
                          issue.severity === "Error" ? "text-orange-900" :
                          "text-amber-900"
                        }`}>{issue.component}</span>
                        <Badge variant="outline" className="text-[10px] uppercase bg-white/50">{issue.severity}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mb-1">{issue.description}</p>
                      <p className="text-xs font-medium">Fix: {issue.recoveryRecommendation}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground text-sm">
              <ShieldCheck className="h-8 w-8 text-emerald-500/50 mb-2" />
              <p>Everything looks perfect!</p>
              <p className="text-xs">Your data is ready to go.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
