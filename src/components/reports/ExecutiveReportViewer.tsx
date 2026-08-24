"use client";

import React, { useState } from "react";
import {
  Download,
  Share2,
  Check,
  Calendar,
  Zap,
  Loader2,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClientReportData } from "@/lib/reports/types";
import { ClientReportCards } from "./ClientReportCard";
import { LeadActivityTable } from "./LeadActivityTable";
import { CampaignRecapSection } from "./CampaignRecapSection";
import { toast } from "sonner";
import { generateDirectClientReportPdf } from "@/lib/reports/pdfGenerator";

interface ExecutiveReportViewerProps {
  report: ClientReportData;
}

function formatTitleCase(str?: string): string {
  if (!str) return "Campaign Report";
  return str
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

export function ExecutiveReportViewer({ report }: ExecutiveReportViewerProps) {
  const [copied, setCopied] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      toast.success("Client report link copied to clipboard");
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleDirectPdfDownload = () => {
    try {
      setIsGeneratingPdf(true);
      generateDirectClientReportPdf(report);
      toast.success("Executive PDF downloaded directly!");
    } catch (err) {
      console.error("PDF generation error:", err);
      window.print();
    } finally {
      setTimeout(() => setIsGeneratingPdf(false), 300);
    }
  };

  const formattedCampaignName = formatTitleCase(report.campaignName);
  const formattedAgencyName = formatTitleCase(report.agencyName);

  return (
    <div className="space-y-6">
      {/* 1. Floating Top Minimal Toolbar (Hidden in PDF) */}
      <div className="no-print bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-2xl p-3 shadow-xs flex items-center justify-between gap-4 max-w-5xl mx-auto">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span>Silaer Client Campaign Report</span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyLink}
            className="gap-1.5 rounded-xl text-xs font-medium border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 h-8"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                Copied
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
            onClick={handleDirectPdfDownload}
            disabled={isGeneratingPdf}
            className="gap-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs h-8"
          >
            {isGeneratingPdf ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Downloading...
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                Download PDF
              </>
            )}
          </Button>
        </div>
      </div>

      {/* 2. The PDF Document Sheet (Clean, Simple, Minimal A4) */}
      <div
        id="report-pdf-document"
        className="report-document-sheet bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-lg p-8 md:p-10 max-w-5xl mx-auto space-y-6 print-page-container print-avoid-break text-slate-900 dark:text-white"
      >
        {/* Simple Brand Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-black text-sm">
              S
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white block leading-none">
                Silaer
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                Client Campaign Report
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-medium">{report.dateRange}</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 font-semibold text-[11px] border border-emerald-200 dark:border-emerald-800">
              {report.status === "ACTIVE" ? "Active" : "Completed"}
            </span>
          </div>
        </div>

        {/* Clean Campaign Title & Single Co-Branding Metadata Line */}
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            {formattedCampaignName}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            <span>Campaign managed by</span>
            <span className="font-semibold text-slate-700 dark:text-slate-300">{formattedAgencyName}</span>
          </p>
        </div>

        {/* 4 Hero KPI Cards */}
        <ClientReportCards metrics={report.metrics} />

        {/* Outbound Activity & Lead Journey Audit Table */}
        <LeadActivityTable activities={report.leadActivities} />

        {/* Campaign Performance Summary */}
        <CampaignRecapSection summaryPoints={report.summaryPoints} />

        {/* Simple & Clean Footer with Natural Text Link */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-emerald-600 fill-current" />
            <span className="font-medium">Powered by Silaer</span>
          </div>

          <a
            href={report.referralUrl || "https://www.silaer.com"}
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-700 dark:text-emerald-400 font-semibold hover:underline"
          >
            www.silaer.com
          </a>
        </div>
      </div>
    </div>
  );
}
