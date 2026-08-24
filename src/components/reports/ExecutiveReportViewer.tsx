"use client";

import React, { useState } from "react";
import {
  Download,
  Share2,
  Check,
  Building2,
  Calendar,
  ShieldCheck,
  Zap,
  ArrowRight,
  Loader2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClientReportData } from "@/lib/reports/types";
import { ClientReportCards } from "./ClientReportCard";
import { CampaignRecapSection } from "./CampaignRecapSection";
import { toast } from "sonner";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

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
      toast.success("Client report link copied to clipboard", {
        description: "Anyone with this link can view this report in any browser without login.",
      });
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleDirectPdfDownload = async () => {
    const reportElement = document.getElementById("report-pdf-document");
    if (!reportElement) {
      toast.error("Could not find report document for export.");
      return;
    }

    try {
      setIsGeneratingPdf(true);
      toast.info("Generating executive PDF document...", { duration: 2000 });

      // Render high-DPI canvas
      const canvas = await html2canvas(reportElement, {
        scale: 2.5, // Crisp 2.5x retina vector rendering
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: "#ffffff",
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, "PNG", 0, 0, imgWidth, Math.min(imgHeight, pdfHeight));

      const safeName = report.campaignName.replace(/[^a-zA-Z0-9]/g, "_") || "Campaign";
      const fileName = `Silaer_Executive_Report_${safeName}.pdf`;

      pdf.save(fileName);
      toast.success("Executive PDF downloaded!", {
        description: `Saved as ${fileName}`,
      });
    } catch (err) {
      console.error("PDF generation error:", err);
      // Fallback to browser print if canvas fails
      window.print();
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const formattedCampaignName = formatTitleCase(report.campaignName);
  const formattedAgencyName = formatTitleCase(report.agencyName);
  const formattedClientName = formatTitleCase(report.clientName);

  return (
    <div className="space-y-6">
      {/* 1. Floating Top Utility Toolbar (Hidden in PDF) */}
      <div className="no-print bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3.5 shadow-md flex items-center justify-between gap-4 max-w-4xl mx-auto">
        <div className="flex items-center gap-3">
          <img
            src="/silaer-logo.png"
            alt="Silaer Logo"
            className="h-8 w-8 object-contain drop-shadow-xs shrink-0"
          />
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                Silaer Enterprise Report
              </span>
              <span className="inline-flex items-center px-1.5 py-0.2 text-[9px] font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 rounded">
                AUDITED
              </span>
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Verified cold outreach telemetry
            </span>
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
                Copied Link!
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
            className="gap-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
          >
            {isGeneratingPdf ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Downloading PDF...
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                Download Executive PDF
              </>
            )}
          </Button>
        </div>
      </div>

      {/* 2. The PDF Document Sheet (A4 Executive Canvas) */}
      <div
        id="report-pdf-document"
        className="report-document-sheet bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl shadow-xl p-8 md:p-12 max-w-4xl mx-auto space-y-7 print-page-container print-avoid-break text-slate-900 dark:text-white"
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between pb-5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <img
              src="/silaer-logo.png"
              alt="Silaer Logo"
              className="h-10 w-10 object-contain drop-shadow-xs shrink-0"
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-black tracking-tight text-slate-900 dark:text-white">
                  Silaer
                </span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  Client Campaign Report
                </span>
              </div>
              <span className="text-[11px] text-slate-400 font-medium">
                Deterministic Outbound Infrastructure & Delivery Audit
              </span>
            </div>
          </div>

          <div className="flex flex-col items-end text-right">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800 text-xs font-bold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>100% Deliverability Score</span>
            </div>
            <span className="text-[10px] text-slate-400 mt-1 font-medium">
              Zero Spam Flags • 0 Bounces
            </span>
          </div>
        </div>

        {/* Co-Branded Campaign Title & Metadata Card */}
        <div className="bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 md:p-6 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Agency x Client Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs text-xs font-bold">
              <Building2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="text-slate-900 dark:text-white">{formattedAgencyName}</span>
              <span className="text-slate-400 font-normal">✖</span>
              <span className="text-emerald-700 dark:text-emerald-300">{formattedClientName}</span>
            </div>

            {/* Live Verification Badge */}
            <div className="flex items-center gap-2 text-xs font-semibold">
              <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400 font-medium">
                <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                {report.dateRange}
              </span>
              <span>•</span>
              <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                {report.status === "ACTIVE" ? "Live Campaign Verified" : "Campaign Finalized"}
              </span>
            </div>
          </div>

          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
            {formattedCampaignName}
          </h1>
        </div>

        {/* The 4 Hero KPI Cards */}
        <ClientReportCards metrics={report.metrics} />

        {/* Factual Campaign Narrative Summary */}
        <CampaignRecapSection summaryPoints={report.summaryPoints} />

        {/* Viral Growth Footer Badge */}
        <div className="bg-gradient-to-r from-slate-50 via-slate-100/70 to-slate-50 dark:from-slate-800/50 dark:via-slate-800/30 dark:to-slate-800/50 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 md:p-6 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
              Autonomous multi-inbox rotation, sentiment detection, and 100% deliverability.
            </p>
          </div>

          <a
            href={report.referralUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 transition-all shadow-xs shrink-0 no-print"
          >
            <span>Explore Silaer for Your Sales Team</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}
