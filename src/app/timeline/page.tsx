import React from "react";
import { Metadata } from "next";
import { TimelineInspector } from "@/components/timeline/TimelineInspector";
import { Sparkles, ShieldCheck, Activity } from "lucide-react";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Email Timeline Inspector | Silaer",
  description: "Detailed end-to-end lifecycle inspection and delivery latencies for outreach emails.",
};

export default async function TimelinePage() {
  // Fetch active theme set in Platform Config Admin Panel
  let bannerTheme = "ORANGE";
  try {
    const config = await prisma.platform_configs.findFirst({ where: { key: "BANNER_THEME" } });
    if (config?.value) {
      bannerTheme = String(config.value).toUpperCase();
    }
  } catch (e) {
    console.error("Failed to load BANNER_THEME in /timeline:", e);
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Dynamic Header Banner */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-xs relative overflow-hidden transition-colors duration-200">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5 relative z-10">
          <div className="flex items-start sm:items-center gap-4">
            <div className="h-11 w-11 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
              <Activity className="h-5 w-5" />
            </div>

            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl md:text-2xl font-bold text-foreground tracking-tight">
                  Email Timeline Inspector
                </h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border border-primary/20 bg-primary/10 text-primary">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  Live Forensics
                </span>
              </div>
              <p className="text-xs md:text-sm text-muted-foreground mt-1">
                Real-time tracking of every email lifecycle event, Gmail API delivery speed, and recipient engagement.
              </p>
            </div>
          </div>

          {/* Clean Stream Status Badges */}
          <div className="flex items-center gap-2.5 shrink-0 self-start md:self-center">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary border border-border text-xs font-semibold text-foreground shadow-2xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span>Live Stream Active</span>
            </div>
            <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary border border-border/80 text-xs font-mono font-medium text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              <span>RFC-822 Verified</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Inspector Component */}
      <TimelineInspector />
    </div>
  );
}
