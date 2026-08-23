"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useImport } from "@/components/providers/ImportProvider";
import { useWarmup } from "@/components/providers/WarmupProvider";
import { ForecastEngine, CampaignConfig, ForecastResult } from "@/lib/import/engines/ForecastEngine";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Check,
  Rocket,
  Clock,
  ShieldCheck,
  Calendar,
  Globe
} from "lucide-react";
import { format } from "date-fns";

export function CampaignPlanningWizard() {
  const { summary, startSequenceBuild } = useImport() as any;
  const { status: warmupStatus, settings: warmupSettings, isLoading: warmupLoading } = useWarmup();

  const [config, setConfig] = useState<CampaignConfig>({
    campaignName: "New Campaign " + format(new Date(), "MMM d, yyyy"),
    startDate: format(new Date(), "yyyy-MM-dd"),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    businessDaysOnly: true,
    speedProfile: "Balanced",
    customDailyLimit: 150,
    integrateWarmup: true,
  });

  const [forecast, setForecast] = useState<ForecastResult | null>(null);
  const forecastEngine = useMemo(() => new ForecastEngine(), []);

  useEffect(() => {
    if (summary && !warmupLoading) {
      const result = forecastEngine.calculateForecast(
        summary.validRows,
        config,
        warmupStatus,
        warmupSettings
      );
      setForecast(result);
    }
  }, [config, summary, warmupStatus, warmupSettings, warmupLoading, forecastEngine]);

  // Real-time Timezone Intelligence calculation
  const targetLocalTime = useMemo(() => {
    try {
      return new Intl.DateTimeFormat("en-US", {
        timeZone: config.timezone,
        hour: "numeric",
        minute: "numeric",
        hour12: true,
      }).format(new Date());
    } catch {
      return "Local Time";
    }
  }, [config.timezone]);

  const isTargetInBusinessHours = useMemo(() => {
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: config.timezone,
        hour: "numeric",
        hour12: false,
      }).formatToParts(new Date());
      const hourPart = parts.find(p => p.type === "hour");
      const hour = hourPart ? parseInt(hourPart.value, 10) : 12;
      return hour >= 9 && hour < 17;
    } catch {
      return true;
    }
  }, [config.timezone]);

  const protections = [
    {
      step: 1,
      title: "Human-Like Dispatch Jitter (3–7 min)",
      desc: "Randomizes intervals between consecutive emails to prevent spam filter fingerprinting.",
    },
    {
      step: 2,
      title: "Atomic Reply Cessation",
      desc: "Immediately terminates future sequence steps within seconds once a lead responds.",
    },
    {
      step: 3,
      title: "Automated Reputation Guardianship",
      desc: `Ramps daily dispatch volume safely across ${forecast?.actualSendingDays || 1} days based on inbox health.`,
    },
    {
      step: 4,
      title: "Multi-Inbox Load Balancing",
      desc: "Evenly distributes first-touch emails across all connected accounts to keep per-domain volume safe.",
    },
    {
      step: 5,
      title: "Sticky Sender & Thread Integrity",
      desc: "Locks follow-up steps strictly to the original sender address and Gmail thread ID.",
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        
        {/* ── Left Column: Configuration ─────────────────────────────────── */}
        <div className="space-y-6">
          <Card className="border-border shadow-xs">
            <CardHeader className="bg-muted/5 border-b border-border py-4">
              <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Rocket className="h-4 w-4 text-foreground" />
                Campaign Parameters
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-5">
              
              {/* Campaign Name Box */}
              <div className="rounded-xl border border-border bg-card p-4 space-y-2">
                <Label className="text-xs font-semibold text-foreground">Campaign Name</Label>
                <Input 
                  value={config.campaignName} 
                  onChange={(e) => setConfig({ ...config, campaignName: e.target.value })} 
                  className="text-xs h-9 bg-background border-border shadow-2xs"
                  placeholder="E.g. Q3 Founder Outreach"
                />
              </div>
              
              {/* Schedule & Timezone Box */}
              <div className="rounded-xl border border-border bg-card p-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                      Start Date
                    </Label>
                    <Input 
                      type="date"
                      value={config.startDate} 
                      onChange={(e) => setConfig({ ...config, startDate: e.target.value })} 
                      className="text-xs h-9 font-mono bg-background border-border shadow-2xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                      Lead&apos;s Timezone
                    </Label>
                    <Select value={config.timezone} onValueChange={(val) => setConfig({...config, timezone: val})}>
                      <SelectTrigger className="text-xs h-9 bg-background border-border shadow-2xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-[260px] text-xs">
                        <SelectItem value="UTC">UTC (Coordinated Universal Time)</SelectItem>
                        <SelectItem value="America/New_York">Eastern Time (US &amp; Canada - New York)</SelectItem>
                        <SelectItem value="America/Chicago">Central Time (US &amp; Canada - Chicago)</SelectItem>
                        <SelectItem value="America/Denver">Mountain Time (US &amp; Canada - Denver)</SelectItem>
                        <SelectItem value="America/Los_Angeles">Pacific Time (US &amp; Canada - Los Angeles)</SelectItem>
                        <SelectItem value="Europe/London">London (GMT / BST)</SelectItem>
                        <SelectItem value="Europe/Paris">Paris, Berlin, Rome (CET / CEST)</SelectItem>
                        <SelectItem value="Asia/Dubai">Dubai, Gulf (GST)</SelectItem>
                        <SelectItem value="Asia/Karachi">Pakistan Standard Time (PKT)</SelectItem>
                        <SelectItem value="Asia/Kolkata">India Standard Time (IST)</SelectItem>
                        <SelectItem value="Asia/Singapore">Singapore, Hong Kong (SGT / HKT)</SelectItem>
                        <SelectItem value="Asia/Tokyo">Tokyo (JST)</SelectItem>
                        <SelectItem value="Australia/Sydney">Sydney, Melbourne (AEST / AEDT)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                      Select your <strong>prospect&apos;s</strong> timezone. Emails will arrive at 9 AM their business time, regardless of where you are.
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-border/60">
                  <div className="space-y-0.5">
                    <div className="text-xs font-semibold text-foreground">Business Days Only</div>
                    <p className="text-[11px] text-muted-foreground">Skip Saturdays & Sundays to protect open rates</p>
                  </div>
                  <Switch 
                    checked={config.businessDaysOnly} 
                    onCheckedChange={(val) => setConfig({...config, businessDaysOnly: val})} 
                  />
                </div>
              </div>

            </CardContent>
          </Card>
        </div>

        {/* ── Right Column: Autonomous Scheduler & Timezone Intelligence Cockpit ─ */}
        <div>
          <Card className="border-border shadow-xs">
            <CardHeader className="bg-muted/5 border-b border-border py-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  Autonomous Scheduler & Timezone Intelligence
                </CardTitle>
                <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-semibold gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  100% Autonomous
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-5">
              
              {/* 1. Timezone & Target Region Live Status Table */}
              <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-border/60">
                  <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    Target Region Time
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-foreground">{targetLocalTime}</span>
                    <Badge variant="secondary" className="text-[10px] font-medium">
                      {isTargetInBusinessHours ? "Within Work Hours" : "Outside Work Hours"}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                  <div className="p-2 rounded-lg bg-muted/20 border border-border/50">
                    <div className="text-[10px] uppercase font-semibold text-muted-foreground">Sending Window</div>
                    <div className="font-mono font-bold text-foreground text-xs mt-0.5">9:00 AM – 5:00 PM</div>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/20 border border-border/50">
                    <div className="text-[10px] uppercase font-semibold text-muted-foreground">Schedule Status</div>
                    <div className="font-semibold text-xs mt-0.5 text-emerald-600 dark:text-emerald-400">
                      {isTargetInBusinessHours ? "Ready for Dispatch" : "Queued for Next 9:00 AM"}
                    </div>
                  </div>
                </div>

                <p className="text-[11px] text-muted-foreground leading-relaxed pt-1">
                  Emails are held in queue and only dispatched during your prospect&apos;s working hours (9 AM–5 PM). No midnight alerts or weekend sends.
                </p>
              </div>

              {/* 2. Unified 5-Point Protection Specification Table */}
              <div className="space-y-2">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Autonomous Protection Suite
                </div>

                <div className="rounded-xl border border-border bg-card divide-y divide-border/60 overflow-hidden">
                  {protections.map((p) => (
                    <div key={p.step} className="p-3 flex items-start gap-3 hover:bg-muted/20 transition-colors">
                      <div className="h-5 w-5 rounded-md bg-muted border border-border text-foreground flex items-center justify-center shrink-0 font-mono font-bold text-[11px] mt-0.5">
                        {p.step}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-xs text-foreground leading-tight">{p.title}</div>
                        <div className="text-[11px] text-muted-foreground leading-normal mt-0.5">{p.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex items-center justify-end pt-2 border-t border-border">
        <Button onClick={() => startSequenceBuild(config)} className="gap-2 shadow-xs font-semibold px-6">
          <Check className="h-4 w-4" />
          Generate Campaign Blueprints
        </Button>
      </div>
    </div>
  );
}
