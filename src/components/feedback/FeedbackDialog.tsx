"use client";

import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star, Sparkles, CheckCircle2, MessageSquareHeart, Rocket, Layout, Clock, Lightbulb, Bug, Heart } from "lucide-react";
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
  2: "Fair & Usable 😐",
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
      }, 2000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to submit feedback";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden border border-border shadow-2xl rounded-2xl">
        {isSuccess ? (
          <div className="p-10 flex flex-col items-center justify-center text-center space-y-4 animate-in fade-in zoom-in duration-300">
            <div className="h-16 w-16 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 flex items-center justify-center shadow-lg shadow-emerald-500/10">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-bold text-foreground">You're Awesome!</h3>
              <p className="text-sm text-muted-foreground max-w-xs">
                Your feedback goes directly to our founding team to help shape the future of OutreachIQ.
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col">
            <DialogHeader className="p-6 pb-4 bg-muted/20 border-b border-border/40">
              <div className="flex items-center gap-2 text-primary font-semibold text-xs tracking-wider uppercase">
                <Sparkles className="h-3.5 w-3.5" /> Founder & Product Feedback
              </div>
              <DialogTitle className="text-xl font-bold text-foreground mt-1">
                How is your experience?
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Rate our speed, deliverability, and UI. We review every submission personally.
              </DialogDescription>
            </DialogHeader>

            <div className="p-6 space-y-6">
              {/* Star Rating Selector */}
              <div className="flex flex-col items-center justify-center space-y-2 py-2 bg-muted/30 rounded-xl border border-border/40">
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
                        className="p-1 rounded-md transition-all hover:scale-125 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        aria-label={`${star} Star`}
                      >
                        <Star
                          className={cn(
                            "h-8 w-8 transition-colors drop-shadow-xs",
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
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
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
                          "px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-all",
                          isSelected
                            ? "bg-primary text-primary-foreground border-primary shadow-xs"
                            : "bg-background text-muted-foreground hover:text-foreground border-border hover:bg-muted/50"
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {cat.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Optional Comment Box */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Your Thoughts & Suggestions (Optional)
                </label>
                <Textarea
                  placeholder="What do you love most or what can we improve for you?"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="min-h-[90px] resize-none text-sm bg-background border-border"
                  maxLength={1500}
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 px-6 bg-muted/20 border-t border-border/40 flex items-center justify-between">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
                className="text-xs text-muted-foreground"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting}
                className="gap-1.5 text-xs font-semibold shadow-sm"
              >
                {isSubmitting ? (
                  "Sending..."
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
