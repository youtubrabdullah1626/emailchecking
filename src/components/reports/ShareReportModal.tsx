"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Share2,
  Copy,
  Check,
  ExternalLink,
  Download,
  ShieldCheck,
  Sparkles,
  RefreshCw,
  Building2,
} from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";

interface ShareReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaignId: string;
  campaignName?: string;
}

export function ShareReportModal({
  isOpen,
  onClose,
  campaignId,
  campaignName,
}: ShareReportModalProps) {
  const [reportUrl, setReportUrl] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [resolvedName, setResolvedName] = useState(campaignName || "Campaign Report");

  useEffect(() => {
    if (isOpen && campaignId) {
      setIsLoading(true);
      apiClient<any>(`/api/reports/token?campaignId=${campaignId}`)
        .then((res) => {
          if (res?.token && typeof window !== "undefined") {
            const fullUrl = `${window.location.origin}/report/${res.token}`;
            setReportUrl(fullUrl);
            if (res.campaignName) setResolvedName(res.campaignName);
          } else if (res?.reportUrl) {
            setReportUrl(res.reportUrl);
            if (res.campaignName) setResolvedName(res.campaignName);
          }
        })
        .catch((err) => {
          console.error("Failed to generate report link:", err);
          toast.error("Could not generate share link", {
            description: "Please ensure the campaign is saved and active.",
          });
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [isOpen, campaignId]);

  const handleCopy = () => {
    if (!reportUrl) return;
    navigator.clipboard.writeText(reportUrl);
    setIsCopied(true);
    toast.success("Client report link copied to clipboard", {
      description: "Clients can open this link on any device without login.",
    });
    setTimeout(() => setIsCopied(false), 2500);
  };

  const handleOpenReport = () => {
    if (reportUrl) {
      window.open(reportUrl, "_blank");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg p-6 space-y-5 rounded-2xl border-border/80 shadow-2xl">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
            <Building2 className="w-4 h-4" />
            <span>Agency Client Reporting</span>
          </div>
          <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
            Share Executive Client Report
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
            Generate an executive-grade campaign performance summary for{" "}
            <span className="font-semibold text-foreground">{resolvedName}</span>. Clients can
            view metrics and download a 1-page PDF without login.
          </DialogDescription>
        </DialogHeader>

        {/* Link Input Section */}
        <div className="space-y-3 pt-1">
          <label className="text-xs font-semibold text-foreground block">
            Public Client Report Link
          </label>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Input
                readOnly
                value={isLoading ? "Generating secure report link..." : reportUrl}
                className="text-xs font-mono bg-muted/40 border-border pr-9 truncate"
              />
              {isLoading && (
                <RefreshCw className="w-3.5 h-3.5 text-muted-foreground animate-spin absolute right-3 top-3" />
              )}
            </div>
            <Button
              onClick={handleCopy}
              disabled={isLoading || !reportUrl}
              className="gap-1.5 shrink-0 bg-primary text-primary-foreground font-semibold text-xs rounded-xl shadow-xs"
            >
              {isCopied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-300" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copy Link
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <Button
            variant="outline"
            onClick={handleOpenReport}
            disabled={isLoading || !reportUrl}
            className="gap-2 text-xs font-semibold rounded-xl border-border hover:bg-muted/80"
          >
            <ExternalLink className="w-3.5 h-3.5 text-primary" />
            Open Live Report
          </Button>

          <Button
            variant="outline"
            onClick={handleOpenReport}
            disabled={isLoading || !reportUrl}
            className="gap-2 text-xs font-semibold rounded-xl border-border hover:bg-muted/80"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            Print / Export PDF
          </Button>
        </div>

        {/* Security & Privacy Guarantee Note */}
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3.5 flex items-start gap-3">
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5 text-xs">
            <p className="font-semibold text-foreground">Client Privacy & Data Isolation</p>
            <p className="text-muted-foreground leading-relaxed">
              Passwords, OAuth tokens, and raw private email addresses are never exposed. Clients
              see high-trust delivery statistics and factual campaign narrative.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
