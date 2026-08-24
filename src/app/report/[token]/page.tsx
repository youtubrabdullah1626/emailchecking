import React from "react";
import { verifyReportToken } from "@/lib/reports/token";
import { getCampaignReportData } from "@/lib/reports/aggregator";
import { ExecutiveReportViewer } from "@/components/reports/ExecutiveReportViewer";
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

  return <ExecutiveReportViewer report={report} />;
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
