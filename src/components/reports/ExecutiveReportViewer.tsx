"use client";

import React, { useState } from "react";
import {
  Download,
  Share2,
  Check,
  Calendar,
  Zap,
  Loader2,
  ShieldCheck,
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

function cleanCampaignTitle(rawTitle?: string): string {
  if (!rawTitle) return "Outreach Campaign";
  return rawTitle
    .replace(/_two_followups/gi, "")
    .replace(/_followups/gi, "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function formatTitleCase(str?: string): string {
  if (!str) return "Outreach Partner";
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

  const cleanedTitle = cleanCampaignTitle(report.campaignName);
  const formattedAgency = formatTitleCase(report.agencyName);

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

      {/* 2. The PDF Document Sheet (Luxury Executive Briefing Layout) */}
      <div
        id="report-pdf-document"
        className="report-document-sheet bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-lg p-8 md:p-12 max-w-5xl mx-auto space-y-7 print-page-container print-avoid-break text-slate-900 dark:text-white"
      >
        {/* Luxury Top Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-black text-sm">
              S
            </div>
            <div>
              <span className="text-base font-bold tracking-tight text-slate-900 dark:text-white block leading-none">
                Silaer
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                Executive Client Briefing
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-medium">{report.dateRange}</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-[10px] border border-slate-200 dark:border-slate-700">
              {report.status === "ACTIVE" ? "Active Campaign" : "Completed"}
            </span>
          </div>
        </div>

        {/* Campaign Title & Clear Strategic Business Overview */}
        <div className="space-y-1.5">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            {cleanedTitle}
          </h1>
          <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 leading-relaxed max-w-3xl">
            Outbound campaign executed by <strong className="text-slate-800 dark:text-slate-200 font-semibold">{formattedAgency}</strong> powered by the Silaer multi-inbox delivery network. Configured to reach targeted decision-makers in their local working hours (London GMT) with 100% domain deliverability protection.
          </p>
        </div>

        {/* 4 Hero KPI Cards */}
        <ClientReportCards metrics={report.metrics} />

        {/* Outbound Activity & Lead Journey Audit Table */}
        <LeadActivityTable activities={report.leadActivities} />

        {/* Campaign Performance Summary & Business Takeaways */}
        <CampaignRecapSection summaryPoints={report.summaryPoints} />

        {/* Simple & Clean Footer with Natural Text Link */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span className="font-medium">Verified Outbound Telemetry • Powered by Silaer</span>
          </div>

          <a
            href={report.referralUrl || "https://www.silaer.com"}
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-600 dark:text-slate-300 font-semibold hover:underline"
          >
            www.silaer.com
          </a>
        </div>
      </div>
    </div>
  );
}
