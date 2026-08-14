"use client";

import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star, Sparkles, CheckCircle2, MessageSquareHeart, Rocket, Layout, Clock, Lightbulb, Bug, Heart, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface FeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCategory?: string;
  sourceContext?: string;
}

const CATEGORIES = [
  { id: "DELIVERABILITY", label: "Deliverability", icon: Rocket },
  { id: "UI_UX", label: "UI & Design", icon: Layout },
  { id: "SCHEDULER", label: "Smart Resets", icon: Clock },
  { id: "FEATURE_REQUEST", label: "Feature Request", icon: Lightbulb },
  { id: "BUG", label: "Found a Bug", icon: Bug },
  { id: "GENERAL", label: "General Love", icon: Heart },
];

const SENTIMENT_LABELS: Record<number, string> = {
  1: "Needs Improvement 🔧",
  2: "Fair 😐",
  3: "Good Experience 👍",
  4: "Very Good & Fast 🚀",
  5: "Loved it! Super Clean & Smart 🔥",
};

export function FeedbackDialog({
  open,
  onOpenChange,
  defaultCategory = "GENERAL",
  sourceContext,
}: FeedbackDialogProps) {
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [category, setCategory] = useState<string>(defaultCategory);
  const [comment, setComment] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  const activeRating = hoverRating !== null ? hoverRating : rating;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating < 1 || rating > 5) {
      toast.error("Please select a star rating");
      return;
    }

    setIsSubmitting(true);
    try {
      const pageUrl = typeof window !== "undefined" ? window.location.pathname : undefined;
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating,
          category,
          comment: comment.trim() || undefined,
          pageUrl: sourceContext || pageUrl,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to send feedback");
      }

      setIsSuccess(true);
      toast.success("Thank you! Your feedback has been received.");
      setTimeout(() => {
        setIsSuccess(false);
        setComment("");
        onOpenChange(false);
      }, 1600);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to submit feedback";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px] max-h-[85vh] w-[95vw] p-0 flex flex-col overflow-hidden border border-border shadow-2xl rounded-2xl bg-card">
        {isSuccess ? (
          <div className="p-8 flex flex-col items-center justify-center text-center space-y-3 animate-in fade-in zoom-in duration-200">
            <div className="h-14 w-14 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 flex items-center justify-center shadow-md shadow-emerald-500/10">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-foreground">You&apos;re Awesome!</h3>
              <p className="text-xs text-muted-foreground max-w-xs">
                Your feedback goes directly to our founding team to help shape OutreachIQ.
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col max-h-[85vh] overflow-hidden">
            {/* Pinned Header */}
            <DialogHeader className="p-5 pb-3 bg-muted/20 border-b border-border/40 shrink-0 text-left">
              <div className="flex items-center gap-1.5 text-primary font-semibold text-[11px] tracking-wider uppercase">
                <Sparkles className="h-3 w-3" /> Founder Feedback
              </div>
              <DialogTitle className="text-lg font-bold text-foreground mt-0.5">
                How is your experience?
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Rate our speed, deliverability, and UI. We review every note personally.
              </DialogDescription>
            </DialogHeader>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Compact Star Rating Selector */}
              <div className="flex flex-col items-center justify-center space-y-1.5 py-3 bg-muted/30 rounded-xl border border-border/40">
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => {
                    const isFilled = star <= activeRating;
                    return (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(null)}
                        className="p-1 rounded-md transition-transform hover:scale-115 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        aria-label={`${star} Star`}
                      >
                        <Star
                          className={cn(
                            "h-7 w-7 transition-colors drop-shadow-2xs",
                            isFilled
                              ? "fill-amber-400 text-amber-400 dark:fill-amber-400 dark:text-amber-400"
                              : "text-muted-foreground/30 fill-transparent hover:text-amber-300"
                          )}
                        />
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs font-semibold text-foreground/90 transition-all">
                  {SENTIMENT_LABELS[activeRating] || "Select your rating"}
                </p>
              </div>

              {/* Quick Feedback Category Chips */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Feedback Topic
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORIES.map((cat) => {
                    const Icon = cat.icon;
                    const isSelected = category === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setCategory(cat.id)}
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-all cursor-pointer",
                          isSelected
                            ? "bg-primary text-primary-foreground border-primary shadow-2xs font-semibold"
                            : "bg-background text-muted-foreground hover:text-foreground border-border hover:bg-muted/60"
                        )}
                      >
                        <Icon className="h-3 w-3" />
                        {cat.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Optional Comment Box */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Your Thoughts (Optional)
                </label>
                <Textarea
                  placeholder="What do you love most or what can we improve for you?"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="min-h-[75px] max-h-[130px] resize-none text-xs bg-background border-border"
                  maxLength={1500}
                />
              </div>
            </div>

            {/* Pinned Footer (Always visible & never cut off) */}
            <div className="p-3.5 px-5 bg-muted/20 border-t border-border/40 flex items-center justify-between shrink-0">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
                className="text-xs text-muted-foreground hover:text-foreground h-8 px-3"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting}
                className="gap-1.5 text-xs font-semibold shadow-xs h-8 px-4"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Sending...
                  </>
                ) : (
                  <>
                    <MessageSquareHeart className="h-3.5 w-3.5" /> Send Feedback
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
