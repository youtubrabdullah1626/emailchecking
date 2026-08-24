import React from "react";
import { notFound } from "next/navigation";
import { verifyReportToken } from "@/lib/reports/token";
import { getCampaignReportData } from "@/lib/reports/aggregator";
import { ReportHeader } from "@/components/reports/ReportHeader";
import { ClientReportCards } from "@/components/reports/ClientReportCard";
import { CampaignRecapSection } from "@/components/reports/CampaignRecapSection";
import { ReportFooterBadge } from "@/components/reports/ReportFooterBadge";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface ReportPageProps {
  params: Promise<{ token: string }> | { token: string };
}

export const dynamic = "force-dynamic";

export default async function ClientReportPage({ params }: ReportPageProps) {
  const resolvedParams = await Promise.resolve(params);
  const token = resolvedParams?.token;

  if (!token) {
    return <InvalidReportScreen message="No report token was provided in the URL." />;
  }

  const verification = verifyReportToken(token);
  if (!verification.valid || !verification.campaignId) {
    return <InvalidReportScreen message="This report link is invalid, expired, or has been revoked." />;
  }

  const report = await getCampaignReportData(verification.campaignId, token);
  if (!report) {
    return <InvalidReportScreen message="The campaign for this report could not be found or has been archived." />;
  }

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-300">
      {/* 1. Header with Co-Branding & Action Buttons */}
      <ReportHeader
        agencyName={report.agencyName}
        clientName={report.clientName}
        campaignName={report.campaignName}
        dateRange={report.dateRange}
        status={report.status}
        shareToken={report.shareToken}
      />

      {/* 2. The 4 Hero KPI Cards (Contacted, Opened, Real Replies, Domain Health) */}
      <ClientReportCards metrics={report.metrics} />

      {/* 3. Factual Campaign Narrative Recap */}
      <CampaignRecapSection summaryPoints={report.summaryPoints} />

      {/* 4. Viral Growth Flywheel Footer */}
      <ReportFooterBadge referralUrl={report.referralUrl} />
    </div>
  );
}

function InvalidReportScreen({ message }: { message: string }) {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto space-y-5">
      <div className="w-16 h-16 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center border border-destructive/20 shadow-xs">
        <ShieldAlert className="w-8 h-8" />
      </div>
      <div className="space-y-2">
        <h1 className="text-xl font-bold text-foreground tracking-tight">Report Unavailable</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">{message}</p>
      </div>
      <Link
        href="/"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground transition-colors border border-border"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Return to Home
      </Link>
    </div>
  );
}
