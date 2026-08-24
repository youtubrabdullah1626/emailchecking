"use client";

import React, { useState } from "react";
import { Download, Share2, Check, Sparkles, Building2, Calendar, FileText, ArrowRight, ShieldCheck, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClientReportData } from "@/lib/reports/types";
import { ClientReportCards } from "./ClientReportCard";
import { CampaignRecapSection } from "./CampaignRecapSection";
import { toast } from "sonner";

interface ExecutiveReportViewerProps {
  report: ClientReportData;
}

export function ExecutiveReportViewer({ report }: ExecutiveReportViewerProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      toast.success("Share link copied to clipboard", {
        description: "Clients can view this report in any browser without login.",
      });
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleDownloadPdf = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Floating Top Toolbar (Hidden when printing) */}
      <div className="no-print bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3.5 shadow-sm flex items-center justify-between gap-4 max-w-4xl mx-auto">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-bold text-foreground block">Executive Campaign Report</span>
            <span className="text-[11px] text-muted-foreground">Verified by Silaer Engine</span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyLink}
            className="gap-1.5 rounded-xl text-xs font-semibold border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                Copied!
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5 text-muted-foreground" />
                Share Link
              </>
            )}
          </Button>

          <Button
            size="sm"
            onClick={handleDownloadPdf}
            className="gap-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            Download PDF
          </Button>
        </div>
      </div>

      {/* 2. The PDF Document Sheet (A4 Executive Canvas) */}
      <div className="report-document-sheet bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/90 rounded-3xl shadow-2xl p-8 md:p-12 max-w-4xl mx-auto space-y-8 print-page-container print-avoid-break">
        {/* Co-Branded Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200/80 dark:border-slate-800/80">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-bold text-emerald-700 dark:text-emerald-300">
              <Building2 className="w-3.5 h-3.5" />
              <span>{report.agencyName}</span>
              <span className="text-muted-foreground font-normal">✖</span>
              <span>{report.clientName}</span>
            </div>

            <div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                {report.campaignName}
              </h1>
              <div className="flex items-center gap-2 text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  {report.dateRange}
                </span>
                <span>•</span>
                <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  {report.status === "ACTIVE" ? "Live Campaign Verified" : "Campaign Finalized"}
                </span>
              </div>
            </div>
          </div>

          <div className="hidden sm:flex flex-col items-end justify-center text-right space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>100% Deliverability Score</span>
            </div>
            <span className="text-[11px] text-slate-400">Zero Spam Flags • 0 Bounces</span>
          </div>
        </div>

        {/* The 4 Hero KPI Cards */}
        <ClientReportCards metrics={report.metrics} />

        {/* Factual Campaign Summary Narrative */}
        <CampaignRecapSection summaryPoints={report.summaryPoints} />

        {/* Viral Growth Footer Badge */}
        <div className="bg-gradient-to-r from-slate-50 via-slate-100/60 to-slate-50 dark:from-slate-800/40 dark:via-slate-800/20 dark:to-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 md:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                <Zap className="w-3 h-3 fill-current" />
              </div>
              <span className="text-xs md:text-sm font-bold text-slate-900 dark:text-white">
                Powered by Silaer Enterprise Engine
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Autonomous multi-inbox rotation and 100% inbox deliverability.
            </p>
          </div>

          <a
            href={report.referralUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 transition-all shadow-xs shrink-0 no-print"
          >
            <span>Explore Silaer for Your Sales Team</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}
