"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Mail, Info, CalendarClock, MessageSquareReply, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { mutate } from "swr";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface QuickEmailComposerProps {
  prospectId: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  hasActiveSequence: boolean;
}

export function QuickEmailComposer({
  prospectId,
  isOpen,
  onOpenChange,
  hasActiveSequence,
}: QuickEmailComposerProps) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [pauseSequence, setPauseSequence] = useState(hasActiveSequence);
  
  // Advanced features
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [replyToLastThread, setReplyToLastThread] = useState(false);
  
  const [isSending, setIsSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insertVariable = (variable: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newBody = body.substring(0, start) + `{{${variable}}}` + body.substring(end);
    
    setBody(newBody);
    
    // Reset focus and cursor position after React re-render
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + variable.length + 4, start + variable.length + 4);
    }, 0);
  };

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) {
      toast.error("Subject and body are required");
      return;
    }

    if (isScheduled && !scheduledAt) {
      toast.error("Please select a valid date and time for scheduling");
      return;
    }

    if (isScheduled && new Date(scheduledAt) <= new Date()) {
      toast.error("Scheduled time must be in the future");
      return;
    }

    setIsSending(true);
    try {
      const res = await fetch("/api/gmail/send-adhoc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prospectId,
          subject,
          body,
          pauseSequence,
          scheduledAt: isScheduled && scheduledAt ? new Date(scheduledAt).toISOString() : null,
          replyToLastThread,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || data.error || "Failed to send email");
      }

      if (data.status === "SCHEDULED") {
        toast.success("Email successfully scheduled!");
      } else {
        toast.success("Email sent instantly!");
      }

      // Reset
      setSubject("");
      setBody("");
      setIsScheduled(false);
      setScheduledAt("");
      setReplyToLastThread(false);
      onOpenChange(false);
      
      mutate(`/api/prospects/${prospectId}/activity`);
      if (pauseSequence) {
        mutate(`/api/sequences`);
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] gap-0 p-0 overflow-y-auto max-h-[90dvh] bg-background">
        <DialogHeader className="px-6 py-4 border-b border-border bg-muted/30 sticky top-0 z-10 backdrop-blur-sm">
          <DialogTitle className="flex items-center gap-2 text-xl font-semibold">
            <Mail className="h-5 w-5 text-primary" />
            Smart Composer
          </DialogTitle>
          <DialogDescription>
            Draft, schedule, and personalize one-off emails for this prospect.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-0">
          {/* Smart Toolbar */}
          <div className="flex items-center gap-2 px-6 py-2 border-b border-border bg-muted/10">
            <span className="text-xs font-medium text-muted-foreground mr-2 flex items-center gap-1">
              <Sparkles className="h-3 w-3" /> Variables:
            </span>
            <Button type="button" variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => insertVariable("first_name")}>
              First Name
            </Button>
            <Button type="button" variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => insertVariable("company")}>
              Company
            </Button>
            <Button type="button" variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => insertVariable("email")}>
              Email
            </Button>
          </div>

          <div className="p-6 space-y-4">
            <div className="grid gap-2">
              <Input
                id="subject"
                placeholder="Subject line..."
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={isSending}
                className="text-base border-0 border-b rounded-none px-0 shadow-none focus-visible:ring-0 focus-visible:border-primary font-medium bg-transparent"
              />
            </div>
            
            <div className="grid gap-2">
              <Textarea
                ref={textareaRef}
                id="body"
                placeholder="Type your message here... Use variables like {{first_name}}"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="min-h-[250px] text-base resize-y border-0 p-0 shadow-none focus-visible:ring-0 bg-transparent leading-relaxed"
                disabled={isSending}
              />
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border bg-muted/20 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Scheduling Toggle */}
            <div className="flex items-center justify-between space-x-2 rounded-lg border p-3 bg-background shadow-sm">
              <div className="space-y-0.5">
                <label className="text-sm font-medium leading-none flex items-center gap-1.5 cursor-pointer" htmlFor="schedule-email">
                  <CalendarClock className="h-4 w-4 text-blue-500" />
                  Schedule Email
                </label>
                <p className="text-[11px] text-muted-foreground">
                  Send at a specific future time.
                </p>
              </div>
              <Switch id="schedule-email" checked={isScheduled} onCheckedChange={setIsScheduled} disabled={isSending} />
            </div>

            {/* Threading Toggle */}
            <div className="flex items-center justify-between space-x-2 rounded-lg border p-3 bg-background shadow-sm">
              <div className="space-y-0.5">
                <label className="text-sm font-medium leading-none flex items-center gap-1.5 cursor-pointer" htmlFor="reply-thread">
                  <MessageSquareReply className="h-4 w-4 text-emerald-500" />
                  Attach to Previous Conversation
                </label>
                <p className="text-[11px] text-muted-foreground">
                  Send as a direct follow-up to your last email.
                </p>
              </div>
              <Switch id="reply-thread" checked={replyToLastThread} onCheckedChange={setReplyToLastThread} disabled={isSending} />
            </div>
          </div>

          {/* Expanded Scheduling Options */}
          {isScheduled && (
            <div className="flex flex-col gap-2 p-3 rounded-lg border bg-blue-50/50 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900 animate-in slide-in-from-top-2">
              <label htmlFor="scheduledAt" className="text-sm font-medium text-blue-800 dark:text-blue-300">
                Select Date & Time
              </label>
              <Input
                type="datetime-local"
                id="scheduledAt"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                disabled={isSending}
                className="w-full sm:w-[250px] bg-background"
              />
            </div>
          )}

          {/* Sequence Pause Toggle */}
          {hasActiveSequence && (
            <div className="flex items-center justify-between space-x-2 rounded-lg border p-3 bg-amber-50/50 dark:bg-amber-950/20 border-amber-100 dark:border-amber-900">
              <div className="space-y-0.5">
                <label htmlFor="pause-sequence" className="text-sm font-medium leading-none cursor-pointer text-amber-900 dark:text-amber-300">
                  Pause active sequence
                </label>
                <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80 flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  Recommended when taking over manually to prevent collision.
                </p>
              </div>
              <Switch
                id="pause-sequence"
                checked={pauseSequence}
                onCheckedChange={setPauseSequence}
                disabled={isSending}
                className="data-[state=checked]:bg-amber-500"
              />
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border bg-background sm:justify-between sticky bottom-0 z-10">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={isSending} className="min-w-[140px] shadow-md font-semibold">
            {isSending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isScheduled ? "Scheduling..." : "Sending..."}
              </>
            ) : (
              isScheduled ? "Schedule Email" : "Send Now"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
