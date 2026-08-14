"use client";

import React, { useEffect, useState } from "react";
import { FeedbackDialog } from "./FeedbackDialog";

/**
 * Global Smart Feedback Trigger Listener
 * 
 * Listens for app milestone events (e.g. `outreachiq:milestone:sequence_started` or
 * `outreachiq:milestone:reply_received`) and checks with the backend if the user
 * has a 30-day cooldown window before showing the prompt.
 */
export function FeedbackTrigger() {
  const [isOpen, setIsOpen] = useState(false);
  const [context, setContext] = useState<string | undefined>(undefined);
  const [defaultCategory, setDefaultCategory] = useState<string>("GENERAL");

  useEffect(() => {
    // 1. Listen for custom UI milestone events
    const handleMilestone = async (e: Event) => {
      const customEvent = e as CustomEvent<{ milestone?: string; category?: string }>;
      const milestone = customEvent.detail?.milestone || "milestone";
      const cat = customEvent.detail?.category || "GENERAL";

      // Check with backend if user can be prompted
      try {
        const res = await fetch("/api/feedback", { method: "GET" });
        if (!res.ok) return;
        const data = await res.json();

        if (data.canPromptMilestone) {
          // Delay popup by 1.5 seconds so it feels natural after an action
          setTimeout(() => {
            setContext(`milestone_${milestone}`);
            setDefaultCategory(cat);
            setIsOpen(true);
          }, 1500);
        }
      } catch {
        // Silently fail if network or offline
      }
    };

    // 2. Listen for manual feedback trigger (e.g. from header / sidebar buttons)
    const handleManualTrigger = (e: Event) => {
      const customEvent = e as CustomEvent<{ category?: string; source?: string }>;
      setDefaultCategory(customEvent.detail?.category || "GENERAL");
      setContext(customEvent.detail?.source || "manual_button");
      setIsOpen(true);
    };

    window.addEventListener("outreachiq:milestone", handleMilestone as EventListener);
    window.addEventListener("outreachiq:open_feedback", handleManualTrigger as EventListener);

    return () => {
      window.removeEventListener("outreachiq:milestone", handleMilestone as EventListener);
      window.removeEventListener("outreachiq:open_feedback", handleManualTrigger as EventListener);
    };
  }, []);

  return (
    <FeedbackDialog
      open={isOpen}
      onOpenChange={setIsOpen}
      defaultCategory={defaultCategory}
      sourceContext={context}
    />
  );
}

/**
 * Utility to trigger the feedback dialog from anywhere in client code
 */
export function openFeedbackDialog(category?: string, source?: string) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("outreachiq:open_feedback", {
        detail: { category, source },
      })
    );
  }
}
