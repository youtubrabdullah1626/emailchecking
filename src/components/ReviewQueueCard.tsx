"use client";

import React, { useState } from "react";
import type { PendingReviewItem } from "@/lib/reply/review";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { LegacyBadge as Badge, LegacyButton as Button } from "@/components/ui/legacy-adapters";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ReviewQueueCardProps {
  item: PendingReviewItem;
  onActionComplete?: () => void;
}

function stripQuotedHistory(snippet: string): string {
  const onWroteMatch = snippet.search(/\bOn [\s\S]{1,200}wrote:/);
  if (onWroteMatch > 0) {
    return snippet.slice(0, onWroteMatch).trim();
  }
  const lines = snippet.split("\n").filter((l) => !l.trimStart().startsWith(">"));
  return lines.join("\n").trim();
}

function ReviewQueueCardComponent({
  item,
  onActionComplete,
}: ReviewQueueCardProps) {
  const [loading, setLoading] = useState(false);

  const [actionDone, setActionDone] = useState(false);

  const handleAction = async (action: "CONFIRM_STOP" | "KEEP_ACTIVE" | "DISMISS") => {
    setLoading(true);

    try {
      const res = await fetch("/api/replies/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewId: item.id, action }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.message || data.error || "Action failed");
      }

      toast.success(data.message || `Successfully processed: ${action}`);
      setActionDone(true);

      if (onActionComplete) {
        setTimeout(onActionComplete, 1200);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Action failed.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  if (actionDone) {
    return (
      <Card className="border-emerald-500/50 bg-emerald-500/10">
        <CardContent className="p-6">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Badge variant="success">✓ Action Completed</Badge>
              <span className="text-xs text-muted-foreground">{new Date().toLocaleTimeString()}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const confidencePct = item.confidence !== null ? Math.round(item.confidence * 100) : null;
  const isHighConfidence = confidencePct !== null && confidencePct >= 70;
  const displaySnippet = item.rawSnippet ? stripQuotedHistory(item.rawSnippet) : null;

  return (
    <Card className="mb-4 hover-elevate transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <CardTitle>{item.prospectName}</CardTitle>
            <span className="text-sm text-muted-foreground">{item.prospectCompany || "No Company"}</span>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="warning">Needs Review</Badge>
            <span className="text-xs text-muted-foreground">{new Date(item.classifiedAt).toLocaleDateString()}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4">
          <div className="bg-muted/50 p-4 rounded-md">
            <div className="flex flex-col gap-2">
              <div className="text-sm">
                <strong className="text-foreground">From:</strong> <span className="text-muted-foreground">{item.prospectEmail}</span>
              </div>
              <div className="text-sm">
                <strong className="text-foreground">Subject:</strong> <span className="text-muted-foreground">{item.subject}</span>
              </div>
              {displaySnippet && (
                <blockquote className="mt-2 pl-3 border-l-2 border-border italic text-muted-foreground text-sm">
                  &ldquo;{displaySnippet}&rdquo;
                </blockquote>
              )}
            </div>
          </div>

          <div className="border border-blue-200 bg-blue-50/50 dark:border-blue-900/50 dark:bg-blue-900/20 p-4 rounded-md">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-blue-700 dark:text-blue-400">✨ Gemini AI Advisory</span>
                {confidencePct !== null && (
                  <Badge variant={isHighConfidence ? "success" : "warning"}>{confidencePct}% Confidence</Badge>
                )}
              </div>
              <div className="text-sm text-muted-foreground">
                <strong className="text-foreground">Suggested Action:</strong>{" "}
                <Badge variant={item.recommendedAction === 'STOP' ? 'danger' : item.recommendedAction === 'KEEP_ACTIVE' ? 'success' : 'warning'} className="ml-2">
                  {item.recommendedAction === "STOP" ? "🛑 Recommend Sequence Stop" : item.recommendedAction === "KEEP_ACTIVE" ? "🟢 Recommend Keep Active" : "⚠️ Manual Operator Review Required"}
                </Badge>
              </div>
              {item.reason && (
                <div className="text-sm text-muted-foreground">
                  <strong className="text-foreground">Reason:</strong> {item.reason}
                </div>
              )}
              {item.signals.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {item.signals.map((sig, idx) => (
                    <span key={idx} className="text-xs bg-background/50 px-2 py-0.5 rounded-full border border-border/50 text-muted-foreground">
                      {sig}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 justify-start mt-2">
            <Button variant="danger" size="sm" onClick={() => handleAction("CONFIRM_STOP")} isLoading={loading}>
              🛑 Confirm Stop
            </Button>
            <Button variant="secondary" size="sm" onClick={() => handleAction("KEEP_ACTIVE")} isLoading={loading}>
              🟢 Keep Active
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleAction("DISMISS")} isLoading={loading}>
              Dismiss
            </Button>
          </div>

        </div>
      </CardContent>
    </Card>
  );
}

export default React.memo(ReviewQueueCardComponent);
