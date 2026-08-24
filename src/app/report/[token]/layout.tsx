import React from "react";
import "@/components/reports/ReportPrintStyles.css";

export const metadata = {
  title: "Client Campaign Report | Silaer",
  description: "Executive cold outreach campaign performance report powered by Silaer Enterprise Engine.",
};

export default function ClientReportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50/60 dark:bg-slate-950 text-foreground transition-colors duration-200">
      <main className="max-w-5xl mx-auto px-4 py-8 md:py-12 print-page-container">
        {children}
      </main>
    </div>
  );
}
