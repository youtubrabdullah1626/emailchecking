"use client";

import React, { useState } from "react";
import { TimelineEmailItem } from "@/app/api/timeline/route";
import {
  X,
  ExternalLink,
  RotateCw,
  Mail,
  Send,
  CheckCircle2,
  XCircle,
  Eye,
  MousePointerClick,
  MessageSquareReply,
  Clock,
  Zap,
  ShieldCheck,
  AlertTriangle,
  Copy,
  Check,
} from "lucide-react";
import { toast } from "sonner";

interface TimelineDetailDrawerProps {
  item: TimelineEmailItem | null;
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

export function TimelineDetailDrawer({
  item,
  isOpen,
  onClose,
  onRefresh,
}: TimelineDetailDrawerProps) {
  const [isRetrying, setIsRetrying] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  if (!isOpen || !item) return null;

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success(`Copied ${field} to clipboard`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleRetry = async () => {
    if (!item.stepId && !item.id) return;
    setIsRetrying(true);
    try {
      const res = await fetch("/api/timeline/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stepId: item.stepId,
          trackedEmailId: item.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Retry failed");
      }
      toast.success("Email Retried Successfully", {
        description: `Delivered with message ID ${data.gmailMessageId?.substring(0, 16)}...`,
      });
      onRefresh();
    } catch (err: any) {
      toast.error("Retry Failed", { description: err.message });
    } finally {
      setIsRetrying(false);
    }
  };

  const formatDateTime = (isoString: string | null | undefined) => {
    if (!isoString) return "—";
    const d = new Date(isoString);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
  };

  const formatLatency = (ms: number | null | undefined) => {
    if (ms === null || ms === undefined) return "—";
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    if (mins < 60) return `${mins}m ${secs}s`;
    const hours = Math.floor(mins / 60);
    return `${hours}h ${mins % 60}m`;
  };

  const gmailSearchUrl = item.gmailMessageId
    ? `https://mail.google.com/mail/u/0/#search/rfc822msgid%3A${encodeURIComponent(item.gmailMessageId)}`
    : null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-sm transition-opacity animate-in fade-in">
      <div className="fixed inset-y-0 right-0 flex max-w-full pl-10">
        <div className="w-screen max-w-2xl bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col">
          {/* Header */}
          <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-orange-500/10 dark:bg-orange-500/20 text-orange-600 flex items-center justify-center font-bold text-sm">
                S{item.stepNumber}
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Timeline Forensic Inspector</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      item.overallStatus === "OPENED"
                        ? "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300"
                        : item.overallStatus === "REPLIED"
                        ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"
                        : item.overallStatus === "SENT"
                        ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300"
                        : item.overallStatus === "FAILED" || item.overallStatus === "BOUNCED"
                        ? "bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    {item.overallStatus}
                  </span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate max-w-md">
                  To: {item.recipientEmail} {item.recipientName ? `(${item.recipientName})` : ""}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Quick Action Banner */}
            <div className="flex items-center gap-3">
              {gmailSearchUrl && (
                <a
                  href={gmailSearchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold hover:bg-slate-800 dark:hover:bg-slate-100 shadow-sm transition-all"
                >
                  <ExternalLink className="h-4 w-4" />
                  <span>View in Gmail Search</span>
                </a>
              )}
              {(item.overallStatus === "FAILED" || item.overallStatus === "BOUNCED") && (
                <button
                  onClick={handleRetry}
                  disabled={isRetrying}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-semibold hover:bg-rose-500 shadow-sm disabled:opacity-50 transition-all"
                >
                  <RotateCw className={`h-4 w-4 ${isRetrying ? "animate-spin" : ""}`} />
                  <span>{isRetrying ? "Retrying..." : "Retry Send Now"}</span>
                </button>
              )}
            </div>

            {/* Lifecycle Stepper */}
            <div className="bg-slate-50 dark:bg-slate-950/40 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800/80">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-4 flex items-center gap-2">
                <Clock className="h-3.5 w-3.5" />
                <span>Lifecycle Flow & Stage Latency</span>
              </h3>

              <div className="space-y-4">
                {/* Step 1: Created */}
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 h-6 w-6 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <div className="flex-1 text-xs">
                    <div className="flex items-center justify-between font-semibold text-slate-800 dark:text-slate-200">
                      <span>1. Step Created & Enqueued</span>
                      <span className="text-slate-400 font-normal">
                        {formatDateTime(item.lifecycle.created.at)}
                      </span>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">
                      Enqueued into outreach sequence dispatch pipeline
                    </p>
                  </div>
                </div>

                {/* Step 2: Scheduled */}
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 h-6 w-6 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <div className="flex-1 text-xs">
                    <div className="flex items-center justify-between font-semibold text-slate-800 dark:text-slate-200">
                      <span>2. Scheduled Window</span>
                      <span className="text-slate-400 font-normal">
                        {formatDateTime(item.lifecycle.scheduled.at)}
                      </span>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">
                      Target timezone & capacity window calculated
                    </p>
                  </div>
                </div>

                {/* Step 3: Gmail Accepted */}
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 h-6 w-6 rounded-full flex items-center justify-center ${
                      item.lifecycle.gmailAccepted.status === "COMPLETED"
                        ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600"
                        : item.lifecycle.gmailAccepted.status === "FAILED"
                        ? "bg-rose-100 dark:bg-rose-950/60 text-rose-600"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                    }`}
                  >
                    {item.lifecycle.gmailAccepted.status === "COMPLETED" ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : item.lifecycle.gmailAccepted.status === "FAILED" ? (
                      <XCircle className="h-4 w-4" />
                    ) : (
                      <div className="h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-600" />
                    )}
                  </div>
                  <div className="flex-1 text-xs">
                    <div className="flex items-center justify-between font-semibold text-slate-800 dark:text-slate-200">
                      <span className="flex items-center gap-1.5">
                        <span>3. Dispatched & Accepted by Gmail</span>
                        {item.lifecycle.gmailAccepted.latencyMs !== null && (
                          <span className="text-[10px] px-1.5 py-0.2 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 rounded font-mono font-medium">
                            +{formatLatency(item.lifecycle.gmailAccepted.latencyMs)}
                          </span>
                        )}
                      </span>
                      <span className="text-slate-400 font-normal">
                        {formatDateTime(item.lifecycle.gmailAccepted.at)}
                      </span>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">
                      Dispatched from inbox {item.senderEmail}
                    </p>
                  </div>
                </div>

                {/* Step 4: Opened */}
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 h-6 w-6 rounded-full flex items-center justify-center ${
                      item.lifecycle.opened.status === "COMPLETED"
                        ? "bg-purple-100 dark:bg-purple-950/60 text-purple-600"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                    }`}
                  >
                    {item.lifecycle.opened.status === "COMPLETED" ? (
                      <Eye className="h-4 w-4" />
                    ) : (
                      <div className="h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-600" />
                    )}
                  </div>
                  <div className="flex-1 text-xs">
                    <div className="flex items-center justify-between font-semibold text-slate-800 dark:text-slate-200">
                      <span className="flex items-center gap-1.5">
                        <span>4. Email Opened</span>
                        {item.lifecycle.opened.count > 0 && (
                          <span className="text-[10px] px-1.5 py-0.2 bg-purple-50 dark:bg-purple-950 text-purple-600 rounded font-bold">
                            {item.lifecycle.opened.count}x
                          </span>
                        )}
                        {item.lifecycle.opened.latencyMs !== null && (
                          <span className="text-[10px] px-1.5 py-0.2 bg-purple-50 dark:bg-purple-950 text-purple-600 rounded font-mono">
                            Opened in {formatLatency(item.lifecycle.opened.latencyMs)}
                          </span>
                        )}
                      </span>
                      <span className="text-slate-400 font-normal">
                        {formatDateTime(item.lifecycle.opened.firstAt)}
                      </span>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">
                      {item.lifecycle.opened.status === "COMPLETED"
                        ? `Last opened: ${formatDateTime(item.lifecycle.opened.lastAt)}`
                        : "Tracking pixel standing by for prospect view"}
                    </p>
                  </div>
                </div>

                {/* Step 5: Replied */}
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 h-6 w-6 rounded-full flex items-center justify-center ${
                      item.lifecycle.replied.status === "COMPLETED"
                        ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                    }`}
                  >
                    {item.lifecycle.replied.status === "COMPLETED" ? (
                      <MessageSquareReply className="h-4 w-4" />
                    ) : (
                      <div className="h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-600" />
                    )}
                  </div>
                  <div className="flex-1 text-xs">
                    <div className="flex items-center justify-between font-semibold text-slate-800 dark:text-slate-200">
                      <span className="flex items-center gap-1.5">
                        <span>5. Prospect Replied</span>
                        {item.lifecycle.replied.latencyMs !== null && (
                          <span className="text-[10px] px-1.5 py-0.2 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 rounded font-mono">
                            Replied in {formatLatency(item.lifecycle.replied.latencyMs)}
                          </span>
                        )}
                      </span>
                      <span className="text-slate-400 font-normal">
                        {formatDateTime(item.lifecycle.replied.at)}
                      </span>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">
                      {item.lifecycle.replied.status === "COMPLETED"
                        ? "Automatic sequence stop triggered & thread preserved"
                        : "Monitoring thread for incoming replies"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Error Diagnostics (if failed) */}
            {item.errorMessage && (
              <div className="bg-rose-50 dark:bg-rose-950/40 rounded-2xl p-5 border border-rose-200 dark:border-rose-900/60 space-y-2">
                <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400 font-semibold text-xs">
                  <AlertTriangle className="h-4 w-4" />
                  <span>Failure Diagnostics</span>
                </div>
                <p className="text-xs font-mono text-rose-800 dark:text-rose-300 bg-rose-100/60 dark:bg-rose-900/40 p-3 rounded-lg break-all">
                  {item.errorMessage}
                </p>
                <div className="text-[11px] text-rose-600 dark:text-rose-400 flex items-center gap-2">
                  <span>Retry count: {item.retryCount} / 3</span>
                </div>
              </div>
            )}

            {/* Technical Identifiers */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-2">
                <Zap className="h-3.5 w-3.5" />
                <span>Technical Identifiers & Delivery Tokens</span>
              </h3>

              <div className="space-y-2.5 text-xs">
                {/* Gmail Message ID */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800/60">
                  <div>
                    <span className="text-[11px] text-slate-400 block">Gmail Message ID</span>
                    <span className="font-mono text-slate-800 dark:text-slate-200 text-xs truncate max-w-xs block">
                      {item.gmailMessageId || "—"}
                    </span>
                  </div>
                  {item.gmailMessageId && (
                    <button
                      onClick={() => copyToClipboard(item.gmailMessageId!, "Gmail Message ID")}
                      className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      {copiedField === "Gmail Message ID" ? (
                        <Check className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                  )}
                </div>

                {/* Gmail Thread ID */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800/60">
                  <div>
                    <span className="text-[11px] text-slate-400 block">Gmail Thread ID</span>
                    <span className="font-mono text-slate-800 dark:text-slate-200 text-xs truncate max-w-xs block">
                      {item.gmailThreadId || "—"}
                    </span>
                  </div>
                  {item.gmailThreadId && (
                    <button
                      onClick={() => copyToClipboard(item.gmailThreadId!, "Gmail Thread ID")}
                      className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      {copiedField === "Gmail Thread ID" ? (
                        <Check className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                  )}
                </div>

                {/* Tracking ID */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800/60">
                  <div>
                    <span className="text-[11px] text-slate-400 block">Tracking Database ID</span>
                    <span className="font-mono text-slate-800 dark:text-slate-200 text-xs truncate max-w-xs block">
                      {item.id}
                    </span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(item.id, "Tracking ID")}
                    className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {copiedField === "Tracking ID" ? (
                      <Check className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Raw Event Stream */}
            {item.events.length > 0 && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-2">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>Audited Event Log ({item.events.length})</span>
                </h3>

                <div className="space-y-2">
                  {item.events.map((ev) => (
                    <div
                      key={ev.id}
                      className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800/60 text-xs flex items-center justify-between"
                    >
                      <div>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {ev.type}
                        </span>
                        {ev.ipAddress && (
                          <span className="text-[10px] text-slate-400 ml-2 font-mono">
                            IP: {ev.ipAddress}
                          </span>
                        )}
                      </div>
                      <span className="text-slate-400 font-mono text-[11px]">
                        {formatDateTime(ev.occurredAt)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
