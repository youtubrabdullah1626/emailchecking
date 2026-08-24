"use client";

import React, { useState } from "react";
import { Download, Share2, Check, Sparkles, Send, Building2, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ReportHeaderProps {
  agencyName: string;
  clientName: string;
  campaignName: string;
  dateRange: string;
  status: string;
  shareToken: string;
}

export function ReportHeader({
  agencyName,
  clientName,
  campaignName,
  dateRange,
  status,
  shareToken,
}: ReportHeaderProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      const url = window.location.href;
      navigator.clipboard.writeText(url);
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
    <div className="bg-card border border-border/80 rounded-2xl p-6 md:p-8 shadow-xs relative overflow-hidden transition-all duration-200 print-avoid-break">
      {/* Subtle brand glow behind header */}
      <div className="absolute top-0 right-0 w-80 h-32 bg-primary/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-10" />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
        <div className="space-y-3">
          {/* Co-Branding Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-semibold text-primary">
            <Building2 className="w-3.5 h-3.5" />
            <span>{agencyName}</span>
            <span className="text-muted-foreground font-normal">✖</span>
            <span>{clientName}</span>
          </div>

          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
              {campaignName}
            </h1>
            <div className="flex flex-wrap items-center gap-3 text-xs md:text-sm text-muted-foreground mt-1.5 font-medium">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-primary" />
                {dateRange}
              </span>
              <span>•</span>
              <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                {status === "ACTIVE" ? "Live Campaign Verified" : "Campaign Finalized"}
              </span>
            </div>
          </div>
        </div>

        {/* Web Action Buttons (Hidden when printing to PDF) */}
        <div className="flex items-center gap-3 no-print">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyLink}
            className="gap-2 rounded-xl text-xs font-medium border-border hover:bg-muted"
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
            className="gap-2 rounded-xl text-xs font-semibold shadow-xs bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Download className="w-3.5 h-3.5" />
            Download Executive PDF
          </Button>
        </div>
      </div>
    </div>
  );
}
