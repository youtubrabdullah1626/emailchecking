"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { LegacyButton as Button, LegacyBadge as Badge } from "@/components/ui/legacy-adapters";
import { Card, CardContent, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui";
import { PageHeader } from "@/components/ui/page-header";
import { AnimatedPage } from "@/components/ui/animated";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Search, AlertCircle, Bot, PlayCircle, StopCircle, Send, Reply } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { Progress } from "@/components/ui/progress";
import { format, formatDistanceToNow } from "date-fns";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const cleanSnippet = (text: string) => {
  if (!text) return { actualReply: "", quotedText: null };
  let clean = text.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  
  const quoteRegex = /On\s+(?:Sun|Mon|Tue|Wed|Thu|Fri|Sat).*?wrote:/i;
  const match = clean.match(quoteRegex);
  
  if (match && match.index !== undefined) {
    const actualReply = clean.substring(0, match.index).trim();
    const quotedText = clean.substring(match.index).trim();
    return { actualReply, quotedText };
  }
  return { actualReply: clean, quotedText: null };
};

interface ReplyItem {
  id: string;
  replyTime: string;
  prospectId: string;
  prospectName: string;
  company: string;
  email: string;
  prospectStatus: string;
  sequenceId: string | null;
  sequenceStatus: string;
  stepNumber: number;
  subject: string;
  replyType: "REAL_REPLY" | "NEEDS_REVIEW" | "AUTO_REPLY" | "SPAM";
  confidence: number;
  reason: string;
  recommendedAction: string;
  actionTaken: string;
  reviewStatus: "PENDING" | "CONFIRMED_STOP" | "CONFIRMED_KEEP_ACTIVE" | "DISMISSED";
  rawSnippet: string;
  gmailThreadId: string;
  gmailMessageId: string;
}

export default function RepliesPage() {
  const [replies, setReplies] = useState<ReplyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"ALL" | "REAL_REPLY" | "NEEDS_REVIEW" | "AUTO_REPLY">("ALL");
  const [selectedReply, setSelectedReply] = useState<ReplyItem | null>(null);
  const [actionProcessing, setActionProcessing] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [quickReplyText, setQuickReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);

  const handleSendQuickReply = async () => {
    if (!quickReplyText.trim() || !selectedReply) return;
    setSendingReply(true);
    try {
      const res = await fetch("/api/gmail/send-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          to: selectedReply.email,
          toName: selectedReply.prospectName,
          subject: `Re: ${selectedReply.subject.replace(/^Re:\s*/i, "")}`,
          content: quickReplyText,
          threadId: selectedReply.gmailThreadId,
          inReplyToMessageId: selectedReply.gmailMessageId,
          originalMessage: {
            date: new Date(selectedReply.replyTime).toLocaleString(),
            from: `${selectedReply.prospectName} <${selectedReply.email}>`,
            text: cleanSnippet(selectedReply.rawSnippet).actualReply
          }
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send reply");
      
      toast.success("Reply sent successfully!");
      setQuickReplyText("");
      setSelectedReply(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send reply");
    } finally {
      setSendingReply(false);
    }
  };

  const loadReplies = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/replies");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to load replies.");
      }
      const data = await res.json();
      setReplies(data.replies ?? []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load replies.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReplies();
  }, [loadReplies]);

  const handleOperatorAction = async (reviewId: string, action: "CONFIRM_STOP" | "KEEP_ACTIVE" | "DISMISS") => {
    setActionProcessing(true);
    try {
      const res = await fetch("/api/replies/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewId, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.detail || "Action failed.");
      setSelectedReply(null);
      await loadReplies();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to execute action.");
    } finally {
      setActionProcessing(false);
    }
  };

  const handleScanReplies = async () => {
    setScanning(true);
    setScanResult(null);
    try {
      const res = await fetch("/api/replies/scan", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.error || "Scan failed.");

      const durationSec = ((data.durationMs ?? 0) / 1000).toFixed(1);
      const summaryText =
        `✅ Scan completed in ${durationSec}s — Scanned ${data.threadsScanned ?? 0} active thread(s). ` +
        `Real replies: ${data.realReplies ?? 0} | Needs review: ${data.needsReview ?? 0} | ` +
        `Already stopped: ${data.alreadyStopped ?? 0} | Auto replies: ${data.autoReplies ?? 0}`;

      setScanResult(summaryText);
      await loadReplies();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Scan failed.";
      setScanResult(`⚠️ ${msg}`);
    } finally {
      setScanning(false);
    }
  };

  const filteredReplies = useMemo(() => {
    return replies.filter((r) => {
      // For NEEDS_REVIEW tab, only show PENDING ones. If it's resolved, it only shows in ALL.
      return activeTab === "ALL" || 
             (activeTab === "NEEDS_REVIEW" ? (r.replyType === "NEEDS_REVIEW" && r.reviewStatus === "PENDING") : r.replyType === activeTab);
    });
  }, [replies, activeTab]);

  const realCount = replies.filter((r) => r.replyType === "REAL_REPLY").length;
  const needsReviewCount = replies.filter((r) => r.replyType === "NEEDS_REVIEW" && r.reviewStatus === "PENDING").length;
  const autoCount = replies.filter((r) => r.replyType === "AUTO_REPLY" || r.replyType === "SPAM").length;

  return (
    <AnimatedPage className="space-y-6 h-full flex flex-col p-8 pt-6">
      <PageHeader
        title="Replies"
        description="Review and manage responses from your prospects."
      >
        <div className="flex gap-2">
          <Button onClick={handleScanReplies} disabled={scanning || loading} variant="primary" className="gap-2">
            {scanning ? "Scanning Gmail..." : "🔍 Scan Replies Now"}
          </Button>
          <Button onClick={loadReplies} disabled={loading || scanning} variant="outline" className="gap-2">
            🔄 Refresh Inbox
          </Button>
        </div>
      </PageHeader>

      {scanResult && (
        <div className={`p-4 rounded-md text-sm font-medium ${scanResult.startsWith('✅') ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {scanResult}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card
          onClick={() => setActiveTab("REAL_REPLY")}
          className="cursor-pointer border-l-4 border-l-emerald-500 hover:shadow-md transition-all duration-200"
        >
          <CardContent className="p-4">
            <div className="text-sm font-medium text-muted-foreground">
              Confirmed Real Replies
            </div>
            <div className="text-3xl font-bold text-emerald-600 my-2">
              {realCount}
            </div>
            <div className="text-xs text-muted-foreground">
              Sequences automatically stopped
            </div>
          </CardContent>
        </Card>

        <Card
          onClick={() => setActiveTab("NEEDS_REVIEW")}
          className={`cursor-pointer border-l-4 border-l-warning hover:shadow-md transition-all duration-200 ${needsReviewCount > 0 ? "bg-warning/10" : ""}`}
        >
          <CardContent className="p-4">
            <div className="text-sm font-medium text-muted-foreground">
              Pending Reviews
            </div>
            <div className="flex items-center gap-2 my-2">
              <div className="text-3xl font-bold text-warning">
                {needsReviewCount}
              </div>
              {needsReviewCount > 0 && <Badge variant="warning">Action Needed</Badge>}
            </div>
            <div className="text-xs text-muted-foreground">
              Ambiguous replies requiring human check
            </div>
          </CardContent>
        </Card>

        <Card
          onClick={() => setActiveTab("AUTO_REPLY")}
          className="cursor-pointer border-l-4 border-l-muted hover:shadow-md transition-all duration-200"
        >
          <CardContent className="p-4">
            <div className="text-sm font-medium text-muted-foreground">
              Auto-Replies / OOO
            </div>
            <div className="text-3xl font-bold text-muted-foreground my-2">
              {autoCount}
            </div>
            <div className="text-xs text-muted-foreground">
              Automated responses safely ignored
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
        <TabsList className="bg-card border border-border h-11 justify-start rounded-lg px-1 py-1 shadow-sm mb-4 w-full overflow-x-auto">
          <TabsTrigger value="ALL">All ({replies.length})</TabsTrigger>
          <TabsTrigger value="NEEDS_REVIEW" className="data-[state=active]:bg-amber-50 data-[state=active]:text-amber-700">Needs Review ({needsReviewCount})</TabsTrigger>
          <TabsTrigger value="REAL_REPLY">Real Replies ({realCount})</TabsTrigger>
          <TabsTrigger value="AUTO_REPLY">Auto / OOO ({autoCount})</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden flex flex-col flex-1">
        {/* Removed search box */}
        <div className="overflow-x-auto mt-0">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>Prospect</TableHead>
              <TableHead>Replied After</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Received</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><div className="h-8 w-48 bg-muted rounded animate-pulse" /></TableCell>
                  <TableCell><div className="h-8 w-32 bg-muted rounded animate-pulse" /></TableCell>
                  <TableCell><div className="h-6 w-24 bg-muted rounded-full animate-pulse" /></TableCell>
                  <TableCell><div className="h-4 w-24 bg-muted rounded animate-pulse" /></TableCell>
                  <TableCell></TableCell>
                </TableRow>
              ))
            ) : filteredReplies.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                  No replies match your criteria.
                </TableCell>
              </TableRow>
            ) : (
              filteredReplies.map((item) => {
                const actionRequired = item.replyType === "NEEDS_REVIEW" && item.reviewStatus === "PENDING";
                
                let classificationStatus: any = "neutral";
                let classificationLabel: string = item.replyType;
                if (item.replyType === "REAL_REPLY") { classificationStatus = "positive"; classificationLabel = "Replied"; }
                else if (item.replyType === "NEEDS_REVIEW") { classificationStatus = "pending_review"; classificationLabel = "Awaiting Review"; }
                else if (item.replyType === "AUTO_REPLY") { classificationStatus = "auto_reply"; classificationLabel = "Auto Reply"; }
                else if (item.replyType === "SPAM") { classificationStatus = "spam"; classificationLabel = "Bounced"; }

                return (
                  <TableRow 
                    key={item.id}
                    className={`cursor-pointer transition-colors ${actionRequired ? 'bg-amber-50/30 hover:bg-amber-50/50' : 'hover:bg-muted/30'}`}
                    onClick={() => setSelectedReply(item)}
                  >
                    <TableCell>
                      <div className="font-medium text-foreground">{item.prospectName}</div>
                      <div className="text-xs text-muted-foreground">{item.company}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-foreground max-w-[200px] whitespace-nowrap overflow-hidden text-ellipsis">
                        {item.stepNumber === 1 ? "First Email" : `Follow-up #${item.stepNumber - 1}`}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={classificationStatus} label={classificationLabel} />
                        {actionRequired && <AlertCircle className="h-4 w-4 text-amber-500" />}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="font-medium text-foreground">
                        {format(new Date(item.replyTime), "MMM d, yyyy")}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(item.replyTime), { addSuffix: true })}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm">Review</Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {selectedReply && (
        <Sheet open={!!selectedReply} onOpenChange={(open) => !open && !actionProcessing && setSelectedReply(null)}>
          <SheetContent className="w-[600px] sm:w-[600px] sm:max-w-none flex flex-col p-0">
            <SheetHeader className="p-6 border-b border-border space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <SheetTitle className="text-xl text-left">{selectedReply.prospectName}</SheetTitle>
                  <div className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                    <span>{selectedReply.company}</span>
                    <span>•</span>
                    <a href={`mailto:${selectedReply.email}`} className="hover:underline text-foreground">
                      {selectedReply.email}
                    </a>
                  </div>
                </div>
                <StatusBadge 
                  status={selectedReply.replyType === 'REAL_REPLY' ? 'positive' : selectedReply.replyType === 'NEEDS_REVIEW' ? 'pending_review' : selectedReply.replyType === 'AUTO_REPLY' ? 'auto_reply' : selectedReply.replyType === 'SPAM' ? 'spam' : 'neutral'} 
                  label={selectedReply.replyType === 'REAL_REPLY' ? 'Real Reply' : selectedReply.replyType === 'NEEDS_REVIEW' ? 'Needs Review' : selectedReply.replyType === 'AUTO_REPLY' ? 'Auto Reply' : selectedReply.replyType === 'SPAM' ? 'Spam' : selectedReply.replyType} 
                />
              </div>
              
            </SheetHeader>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-muted/10">
              <div className="flex flex-col items-start">
                <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{selectedReply.prospectName}</span>
                  <span>{formatDistanceToNow(new Date(selectedReply.replyTime), { addSuffix: true })}</span>
                </div>
                <div className="p-4 rounded-xl max-w-[95%] text-sm leading-relaxed bg-card border border-border shadow-sm rounded-tl-none whitespace-pre-wrap text-foreground">
                  {(() => {
                    const { actualReply, quotedText } = cleanSnippet(selectedReply.rawSnippet);
                    return (
                      <>
                        <div className="mb-2">{actualReply || "No message content."}</div>
                        {quotedText && (
                          <details className="mt-4 pt-4 border-t border-border cursor-pointer group">
                            <summary className="text-xs font-semibold text-muted-foreground uppercase tracking-wider group-hover:text-primary transition-colors">Show Quoted Thread</summary>
                            <div className="mt-2 text-xs text-muted-foreground/80 italic pl-4 border-l-2 border-border/50">
                              {quotedText}
                            </div>
                          </details>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground pt-4 border-t border-border/50">
                <div>Thread ID: <code className="text-[10px]">{selectedReply.gmailThreadId}</code></div>
                <div>Message ID: <code className="text-[10px]">{selectedReply.gmailMessageId}</code></div>
              </div>

              {/* Quick Reply Box */}
              <div className="mt-6 bg-card border border-border rounded-xl shadow-sm p-4">
                <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Reply className="h-4 w-4" /> Quick Reply
                </h4>
                <Textarea 
                  placeholder="Type your reply here..." 
                  value={quickReplyText}
                  onChange={(e) => setQuickReplyText(e.target.value)}
                  className="min-h-[100px] mb-3 bg-background resize-none focus-visible:ring-1"
                />
                <div className="flex justify-end">
                  <Button 
                    onClick={handleSendQuickReply} 
                    disabled={sendingReply || !quickReplyText.trim()}
                    className="gap-2 shadow-sm"
                  >
                    {sendingReply ? "Sending..." : "Send Reply"} <Send className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-border bg-background">
              {selectedReply.replyType === "NEEDS_REVIEW" && selectedReply.reviewStatus === "PENDING" ? (
                <div className="flex items-center justify-between w-full">
                  <Button
                    disabled={actionProcessing}
                    onClick={() => handleOperatorAction(selectedReply.id, "DISMISS")}
                    variant="ghost"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    Dismiss
                  </Button>
                  <div className="flex gap-3">
                    <Button
                      disabled={actionProcessing}
                      onClick={() => handleOperatorAction(selectedReply.id, "KEEP_ACTIVE")}
                      variant="outline"
                      className="gap-2"
                    >
                      <PlayCircle className="h-4 w-4" /> Keep Sequence Active
                    </Button>
                    <Button
                      disabled={actionProcessing}
                      onClick={() => handleOperatorAction(selectedReply.id, "CONFIRM_STOP")}
                      variant="danger"
                      className="gap-2"
                    >
                      <StopCircle className="h-4 w-4" /> Stop Sequence
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex justify-end">
                  <Button onClick={() => setSelectedReply(null)} variant="outline">
                    Close
                  </Button>
                </div>
              )}
            </div>
          </SheetContent>
        </Sheet>
      )}
      </div>
    </AnimatedPage>
  );
}
