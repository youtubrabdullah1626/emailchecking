"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useImport } from "@/components/providers/ImportProvider";
import { useWarmup } from "@/components/providers/WarmupProvider";
import { ForecastEngine, CampaignConfig, SpeedProfile, ForecastResult } from "@/lib/import/engines/ForecastEngine";
import { SessionRecoveryEngine, ImportSessionMetadata } from "@/lib/recovery/SessionRecoveryEngine";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Check, Calendar, Activity, Rocket, Clock, Info } from "lucide-react";
import { format } from "date-fns";

export function CampaignPlanningWizard() {
  const { summary, startSequenceBuild, setAppendTargetSessionId, appendTargetSessionId } = useImport() as any;
  const { status: warmupStatus, settings: warmupSettings, isLoading: warmupLoading } = useWarmup();

  const [campaignMode, setCampaignMode] = useState<"NEW" | "CONTINUE">(appendTargetSessionId ? "CONTINUE" : "NEW");
  const [existingCampaigns, setExistingCampaigns] = useState<ImportSessionMetadata[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>(appendTargetSessionId || "");

  useEffect(() => {
    const engine = new SessionRecoveryEngine();
    const sessions = engine.getAllSessions();
    const continuable = sessions.filter(s => s.status === "COMPLETED" || s.status === "EXECUTING");
    setExistingCampaigns(continuable);
  }, []);

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

  useEffect(() => {
    if (campaignMode === "CONTINUE" && selectedCampaignId) {
      const configStr = localStorage.getItem(`session_${selectedCampaignId}_config`);
      if (configStr) {
         try {
           const existingConfig = JSON.parse(configStr);
           setConfig(existingConfig);
           if (setAppendTargetSessionId) setAppendTargetSessionId(selectedCampaignId);
         } catch(e) {}
      }
    } else {
      if (setAppendTargetSessionId) setAppendTargetSessionId(null);
    }
  }, [campaignMode, selectedCampaignId, setAppendTargetSessionId]);

  const totalLeads = summary?.validRows || 0;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Configuration Column */}
        <div className="space-y-6">
          <Card className="border-border shadow-sm">
            <CardHeader className="bg-muted/5 border-b border-border pb-4">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Rocket className="h-4 w-4 text-primary" />
                Campaign Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              
              <div className="space-y-4">
                <Label>Campaign Mode</Label>
                <div className="flex gap-4">
                  <Button 
                    variant={campaignMode === "NEW" ? "default" : "outline"} 
                    onClick={() => setCampaignMode("NEW")}
                    className="w-full"
                  >
                    Create New Campaign
                  </Button>
                  <Button 
                    variant={campaignMode === "CONTINUE" ? "default" : "outline"} 
                    onClick={() => setCampaignMode("CONTINUE")}
                    className="w-full"
                    disabled={existingCampaigns.length === 0}
                  >
                    Append to Existing
                  </Button>
                </div>
                {existingCampaigns.length === 0 && (
                  <p className="text-xs text-muted-foreground">No existing active campaigns to append to.</p>
                )}
              </div>

              {campaignMode === "CONTINUE" && (
                <div className="space-y-4 pt-4 border-t opacity-100 transition-opacity" style={{ opacity: campaignMode === "CONTINUE" ? 0.7 : 1, pointerEvents: campaignMode === "CONTINUE" ? "none" : "auto" }}>
                  <Label>Select Target Campaign</Label>
                  <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a campaign..." />
                    </SelectTrigger>
                    <SelectContent>
                      {existingCampaigns.map(c => (
                        <SelectItem key={c.sessionId} value={c.sessionId}>
                          {c.campaignName || "Untitled Campaign"} ({c.totalRecords} leads, {c.status})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedCampaignId && (
                    <Alert className="mt-2 bg-blue-50/50 text-blue-800 border-blue-200">
                      <Info className="h-4 w-4 text-blue-600" />
                      <AlertDescription className="text-xs ml-2">
                        Configuration is locked to match the existing campaign&apos;s schedule and timezone.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}

              {campaignMode === "NEW" && (
                <div className="space-y-2">
                  <Label>Campaign Name</Label>
                  <Input 
                    value={config.campaignName} 
                    onChange={(e) => setConfig({ ...config, campaignName: e.target.value })} 
                  />
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4 opacity-100 transition-opacity" style={{ opacity: campaignMode === "CONTINUE" ? 0.7 : 1, pointerEvents: campaignMode === "CONTINUE" ? "none" : "auto" }}>
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input 
                    type="date"
                    value={config.startDate} 
                    onChange={(e) => setConfig({ ...config, startDate: e.target.value })} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Timezone</Label>
                  <Select value={config.timezone} onValueChange={(val) => setConfig({...config, timezone: val})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      <SelectItem value="UTC">UTC (Coordinated Universal Time)</SelectItem>
                      
                      {/* Americas */}
                      <SelectItem value="America/Los_Angeles">Pacific Time (US & Canada)</SelectItem>
                      <SelectItem value="America/Denver">Mountain Time (US & Canada)</SelectItem>
                      <SelectItem value="America/Chicago">Central Time (US & Canada)</SelectItem>
                      <SelectItem value="America/New_York">Eastern Time (US & Canada)</SelectItem>
                      <SelectItem value="America/Sao_Paulo">Brasilia Time (South America)</SelectItem>
                      
                      {/* Europe */}
                      <SelectItem value="Europe/London">London (GMT/BST)</SelectItem>
                      <SelectItem value="Europe/Paris">Central European Time (CET)</SelectItem>
                      <SelectItem value="Europe/Istanbul">Eastern European Time (EET/TRT)</SelectItem>
                      
                      {/* Middle East & Asia */}
                      <SelectItem value="Asia/Dubai">Gulf Standard Time (GST)</SelectItem>
                      <SelectItem value="Asia/Karachi">Pakistan Standard Time (PKT)</SelectItem>
                      <SelectItem value="Asia/Kolkata">India Standard Time (IST)</SelectItem>
                      <SelectItem value="Asia/Bangkok">Indochina Time (ICT)</SelectItem>
                      <SelectItem value="Asia/Shanghai">China Standard Time (CST)</SelectItem>
                      <SelectItem value="Asia/Tokyo">Japan Standard Time (JST)</SelectItem>
                      
                      {/* Oceania */}
                      <SelectItem value="Australia/Sydney">Australian Eastern Time (AET)</SelectItem>
                      <SelectItem value="Pacific/Auckland">New Zealand Standard Time (NZST)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Sending Speed Profile</Label>
                <Select value={config.speedProfile} onValueChange={(val: SpeedProfile) => setConfig({...config, speedProfile: val})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Conservative">Conservative (50/day)</SelectItem>
                    <SelectItem value="Balanced">Balanced (150/day)</SelectItem>
                    <SelectItem value="Aggressive">Aggressive (300/day)</SelectItem>
                    <SelectItem value="Custom">Custom Limit</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {config.speedProfile === "Custom" && (
                <div className="space-y-2">
                  <Label>Custom Daily Limit</Label>
                  <Input 
                    type="number"
                    min={1}
                    value={config.customDailyLimit} 
                    onChange={(e) => setConfig({ ...config, customDailyLimit: parseInt(e.target.value) || 1 })} 
                  />
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <div className="space-y-0.5">
                  <Label>Business Days Only</Label>
                </div>
                <Switch 
                  checked={config.businessDaysOnly}
                  onCheckedChange={(val) => setConfig({ ...config, businessDaysOnly: val })}
                />
              </div>

            </CardContent>
          </Card>
        </div>

        {/* Forecast Column */}
        <div className="space-y-6">
          <Card className="border-border shadow-sm h-full flex flex-col">
            <CardHeader className="bg-muted/5 border-b border-border pb-4">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                Execution Forecast
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 space-y-6 pt-6">
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted/30 rounded-lg p-4 border border-border/50">
                  <div className="text-sm text-muted-foreground font-medium mb-1">Total Leads</div>
                  <div className="text-2xl font-bold">{totalLeads.toLocaleString()}</div>
                </div>
                <div className="bg-muted/30 rounded-lg p-4 border border-border/50">
                  <div className="text-sm text-muted-foreground font-medium mb-1">Sending Days</div>
                  <div className="text-2xl font-bold">{forecast?.actualSendingDays || 0}</div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Calendar className="h-4 w-4" /> Start Date
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{config.startDate}</span>
                    {forecast?.dailyForecast && forecast.dailyForecast.find(d => d.leadsSent > 0)?.date && forecast.dailyForecast.find(d => d.leadsSent > 0)?.date !== config.startDate && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger type="button" className="inline-flex cursor-help ml-1">
                            <Info className="h-4 w-4 text-primary/70 hover:text-primary transition-colors" />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[250px] text-xs">
                            <p><strong>Note:</strong> Your selected Start Date falls on a weekend or closed window. Because you have selected &apos;Business Days Only&apos;, sending will intelligently start on the next available business day: <strong>{forecast.dailyForecast.find(d => d.leadsSent > 0)?.date}</strong>.</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Clock className="h-4 w-4" /> Est. Completion
                  </span>
                  <span className="font-medium text-primary">
                    {forecast?.estimatedCompletionDate || "N/A"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex items-center justify-end pt-4 border-t border-border">
        <Button onClick={() => startSequenceBuild(config)} className="gap-2 shadow-md">
          <Check className="h-4 w-4" />
          Generate Campaign Blueprints
        </Button>
      </div>
    </div>
  );
}
