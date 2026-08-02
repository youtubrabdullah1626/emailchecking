"use client";

/**
 * SendNowButton — Immediate Send control for a single PENDING sequence step.
 *
 * UI behavior:
 *   - Idle:     "⚡ Send Now"  (enabled)
 *   - Sending:  "Sending…"    (disabled + spinner)
 *   - Success:  "✅ Sent!"    (disabled, auto-clears after 4 s → triggers refresh)
 *   - Error:    "❌ Failed"   (re-enabled after 3 s, error message shown below)
 *
 * Safety:
 *   - Only shown for PENDING steps (caller is responsible for this guard)
 *   - Double-click protection: button is disabled while any send is in flight
 *   - Server enforces atomic claim — concurrent clicks cannot double-send
 */

import { useState, useCallback } from "react";

interface SendNowButtonProps {
  stepId: string;
  stepNumber: number;
  /** Called after a successful send so the parent can refresh sequence state */
  onSuccess: (stepId: string, gmailMessageId: string) => void;
}

type SendState = "idle" | "sending" | "success" | "error";

export default function SendNowButton({
  stepId,
  stepNumber,
  onSuccess,
}: SendNowButtonProps) {
  const [state, setState] = useState<SendState>("idle");
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  const handleSendNow = useCallback(async () => {
    if (state === "sending") return; // double-click guard

    setState("sending");
    setErrorDetail(null);

    try {
      const res = await fetch("/api/gmail/send-now", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stepId }),
      });

      const json = await res.json().catch(() => ({ ok: false, detail: "Invalid response from server." }));

      if (json.ok) {
        setState("success");
        // Notify parent to refresh UI
        onSuccess(stepId, json.gmailMessageId ?? "");
        // Reset button after 4 s (page will have refreshed by then)
        setTimeout(() => setState("idle"), 4000);
      } else {
        const detail =
          json.detail ??
          json.error ??
          "Send failed. Check server logs.";
        setErrorDetail(detail);
        setState("error");
        // Re-enable after 3 s
        setTimeout(() => setState("idle"), 3000);
      }
    } catch {
      setErrorDetail("Network error. Check your connection and try again.");
      setState("error");
      setTimeout(() => setState("idle"), 3000);
    }
  }, [stepId, state, onSuccess]);

  const isDisabled = state === "sending" || state === "success";

  return (
    <div className="send-now-wrapper" data-step-id={stepId}>
      <button
        type="button"
        className={`btn send-now-btn${
          state === "success" ? " send-now-btn--success" : ""
        }${state === "error" ? " send-now-btn--error" : ""}`}
        onClick={handleSendNow}
        disabled={isDisabled}
        id={`send-now-step-${stepNumber}`}
        aria-label={`Send Step ${stepNumber} immediately`}
        title="Bypass scheduling and send this email right now"
      >
        {state === "idle" && (
          <>
            <span className="send-now-icon">⚡</span>
            Send Now
          </>
        )}
        {state === "sending" && (
          <>
            <span className="send-now-spinner" aria-hidden="true" />
            Sending…
          </>
        )}
        {state === "success" && (
          <>
            <span className="send-now-icon">✅</span>
            Sent!
          </>
        )}
        {state === "error" && (
          <>
            <span className="send-now-icon">❌</span>
            Failed
          </>
        )}
      </button>

      {state === "error" && errorDetail && (
        <p className="send-now-error" role="alert">
          {errorDetail}
        </p>
      )}
    </div>
  );
}
