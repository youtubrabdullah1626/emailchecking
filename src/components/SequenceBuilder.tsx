"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { Prospect } from "@prisma/client";
import type { SequenceWithSteps } from "@/lib/db/sequences";
import StepEditor, { type StepFormData, type StepErrors } from "@/components/StepEditor";
import SequencePreview from "@/components/SequencePreview";
import StartSequenceDialog from "@/components/StartSequenceDialog";
import { StatusBadge } from "@/components/ui/status-badge";
import SendNowButton from "@/components/SendNowButton";
import { utcToLocalDate, utcToLocalTime, daysBetween } from "@/lib/scheduling";
import { LegacyButton as Button } from "@/components/ui/legacy-adapters";
import { AnimatedPage } from "@/components/ui/animated";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SequenceBuilderProps {
  prospect: Prospect;
  existingSequence: SequenceWithSteps | null;
}

type AllStepErrors = Record<number, StepErrors>;

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayDateString(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function makeNewStep(index: number, defaultTimezone: string): StepFormData {
  return {
    step_number: index + 1,
    subject: "",
    body: "",
    send_time: "09:00",
    timezone: defaultTimezone,
    send_date: index === 0 ? todayDateString() : "",
    delay_days: "3",
  };
}

/**
 * Convert a stored SequenceStep from the DB back into the form shape.
 * Reverses the UTC → local computation so the user sees their original inputs.
 */
function stepToFormData(
  step: SequenceWithSteps["steps"][number],
  previousStep: SequenceWithSteps["steps"][number] | null
): StepFormData {
  const tz = step.timezone;
  const localDate = utcToLocalDate(new Date(step.scheduled_at_utc), tz);
  const localTime = step.scheduled_time_local || utcToLocalTime(new Date(step.scheduled_at_utc), tz);

  let delay_days = "3";
  if (previousStep) {
    const prevDate = utcToLocalDate(new Date(previousStep.scheduled_at_utc), tz);
    const diff = daysBetween(prevDate, localDate);
    delay_days = String(Math.max(1, diff));
  }

  return {
    step_number: step.step_number,
    subject: step.subject,
    body: step.body,
    send_time: localTime,
    timezone: tz,
    send_date: step.step_number === 1 ? localDate : "",
    delay_days,
  };
}

/**
 * Convert form steps into the API payload.
 */
function stepsToApiPayload(steps: StepFormData[]): object {
  return {
    steps: steps.map((s) => ({
      step_number: s.step_number,
      subject: s.subject,
      body: s.body,
      send_time: s.send_time,
      timezone: s.timezone,
      ...(s.step_number === 1
        ? { send_date: s.send_date }
        : { delay_days: parseInt(s.delay_days, 10) }),
    })),
  };
}

/**
 * Parse server field errors (e.g., "steps.0.subject") into the per-step error map.
 */
function parseServerErrors(
  errors: { field: string; message: string }[]
): { stepErrors: AllStepErrors; generalError: string | null } {
  const stepErrors: AllStepErrors = {};
  let generalError: string | null = null;

  for (const e of errors) {
    const match = e.field.match(/^steps\.(\d+)\.(.+)$/);
    if (match) {
      const idx = Number(match[1]);
      const field = match[2] as keyof StepErrors;
      if (!stepErrors[idx]) stepErrors[idx] = {};
      stepErrors[idx][field] = e.message;
    } else {
      generalError = e.message;
    }
  }

  return { stepErrors, generalError };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SequenceBuilder({
  prospect,
  existingSequence,
}: SequenceBuilderProps) {
  const router = useRouter();

  // ── Initialize steps from existing sequence or empty ──
  const initialSteps: StepFormData[] = existingSequence
    ? existingSequence.steps.map((s, i) =>
        stepToFormData(s, i > 0 ? existingSequence.steps[i - 1] : null)
      )
    : [makeNewStep(0, prospect.timezone)];

  const [steps, setSteps] = useState<StepFormData[]>(initialSteps);
  const [stepErrors, setStepErrors] = useState<AllStepErrors>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showStartDialog, setShowStartDialog] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [savedSequence, setSavedSequence] = useState<SequenceWithSteps | null>(existingSequence);
  // Track step IDs that were immediately sent (for real-time UI update before router.refresh)
  const [justSentStepIds, setJustSentStepIds] = useState<Set<string>>(new Set());

  const sequenceId = savedSequence?.id;
  const sequenceStatus = savedSequence?.status ?? "DRAFT";
  const isReadOnly = sequenceStatus !== "DRAFT";
  const MAX_STEPS = 4;

  // ── Step management ───────────────────────────────────────────────────────

  const updateStep = useCallback((index: number, updated: StepFormData) => {
    setSteps((prev) => prev.map((s, i) => (i === index ? updated : s)));
    // Clear the error for that field on change
    setStepErrors((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
    setGeneralError(null);
  }, []);

  const addStep = useCallback(() => {
    setSteps((prev) => [
      ...prev,
      makeNewStep(prev.length, prospect.timezone),
    ]);
  }, [prospect.timezone]);

  const removeStep = useCallback((index: number) => {
    setSteps((prev) =>
      prev
        .filter((_, i) => i !== index)
        .map((s, i) => ({ ...s, step_number: i + 1 }))
    );
    setStepErrors((prev) => {
      const next: AllStepErrors = {};
      let newIdx = 0;
      for (let i = 0; i < Object.keys(prev).length + 1; i++) {
        if (i !== index && prev[i]) {
          next[newIdx] = prev[i];
          newIdx++;
        }
      }
      return next;
    });
  }, []);

  const duplicateStep = useCallback((index: number) => {
    setSteps((prev) => {
      if (prev.length >= MAX_STEPS) return prev;
      const stepToCopy = prev[index];
      const newStep = { ...stepToCopy };
      const next = [...prev];
      next.splice(index + 1, 0, newStep);
      return next.map((s, i) => ({ ...s, step_number: i + 1 }));
    });
  }, []);

  const moveStepUp = useCallback((index: number) => {
    setSteps((prev) => {
      if (index === 0) return prev;
      const next = [...prev];
      const temp = next[index];
      next[index] = next[index - 1];
      next[index - 1] = temp;
      // When moving step 0 to step 1, step 0 must now have a delay_days instead of send_date, and vice versa.
      // But preserving exactly the properties makes it simple, or we can just swap the data.
      return next.map((s, i) => ({ ...s, step_number: i + 1 }));
    });
  }, []);

  const moveStepDown = useCallback((index: number) => {
    setSteps((prev) => {
      if (index === prev.length - 1) return prev;
      const next = [...prev];
      const temp = next[index];
      next[index] = next[index + 1];
      next[index + 1] = temp;
      return next.map((s, i) => ({ ...s, step_number: i + 1 }));
    });
  }, []);

  // ── Save draft ────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setGeneralError(null);
    setStepErrors({});

    const payload = stepsToApiPayload(steps);
    const isCreate = !sequenceId;
    const url = isCreate
      ? `/api/prospects/${prospect.id}/sequence`
      : `/api/sequences/${sequenceId}`;
    const method = isCreate ? "POST" : "PUT";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (json.errors && Array.isArray(json.errors)) {
          const { stepErrors: se, generalError: ge } = parseServerErrors(json.errors);
          setStepErrors(se);
          setGeneralError(ge ?? json.error ?? "Validation failed.");
        } else {
          setGeneralError(json.error ?? "Failed to save. Please try again.");
        }
        return;
      }

      setSavedSequence(json.data);
      // Refresh server data without full navigation
      router.refresh();
    } catch {
      setGeneralError("Network error. Check your connection and try again.");
    } finally {
      setIsSaving(false);
    }
  }, [steps, sequenceId, prospect.id, router]);

  // ── Start sequence ────────────────────────────────────────────────────────

  const handleStart = useCallback(async () => {
    if (!sequenceId) return;
    setIsStarting(true);
    setStartError(null);

    try {
      const res = await fetch(`/api/sequences/${sequenceId}/start`, {
        method: "POST",
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        setStartError(json.error ?? "Failed to start. Please try again.");
        return;
      }

      setSavedSequence(json.data);
      setShowStartDialog(false);
      router.refresh();
    } catch {
      setStartError("Network error. Check your connection and try again.");
    } finally {
      setIsStarting(false);
    }
  }, [sequenceId, router]);

  // ── Send Now success handler ───────────────────────────────────────────────

  const handleSendNowSuccess = useCallback((stepId: string) => {
    setJustSentStepIds((prev) => new Set(prev).add(stepId));
    // Refresh server-side data so the page shows updated status
    setTimeout(() => router.refresh(), 1500);
  }, [router]);

  // ── Retry-and-send handler for FAILED steps ───────────────────────────────

  const [retryingStepIds, setRetryingStepIds] = useState<Set<string>>(new Set());
  const [retryErrors, setRetryErrors] = useState<Record<string, string>>({});

  const handleRetryAndSend = useCallback(async (stepId: string, sequenceId: string) => {
    setRetryingStepIds((prev) => new Set(prev).add(stepId));
    setRetryErrors((prev) => { const n = { ...prev }; delete n[stepId]; return n; });

    try {
      // Step 1: reset FAILED → PENDING
      const retryRes = await fetch(`/api/sequences/${sequenceId}/retry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stepIds: [stepId] }),
      });
      const retryJson = await retryRes.json().catch(() => ({ ok: false }));
      if (!retryRes.ok || !retryJson.ok) {
        setRetryErrors((prev) => ({
          ...prev,
          [stepId]: retryJson.error ?? "Retry reset failed.",
        }));
        return;
      }

      // Step 2: send immediately
      const sendRes = await fetch("/api/gmail/send-now", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stepId }),
      });
      const sendJson = await sendRes.json().catch(() => ({ ok: false }));
      if (sendJson.ok) {
        handleSendNowSuccess(stepId);
      } else {
        setRetryErrors((prev) => ({
          ...prev,
          [stepId]: sendJson.detail ?? sendJson.error ?? "Send failed after retry.",
        }));
        setTimeout(() => router.refresh(), 1500);
      }
    } catch {
      setRetryErrors((prev) => ({ ...prev, [stepId]: "Network error during retry." }));
    } finally {
      setRetryingStepIds((prev) => { const n = new Set(prev); n.delete(stepId); return n; });
    }
  }, [handleSendNowSuccess, router]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <AnimatedPage className="space-y-8 pb-12">
      {/* Modals */}
      {showPreview && savedSequence && (
        <SequencePreview
          steps={savedSequence.steps}
          prospectName={prospect.name}
          prospectEmail={prospect.email}
          onClose={() => setShowPreview(false)}
        />
      )}

      {showStartDialog && savedSequence && (
        <StartSequenceDialog
          sequence={savedSequence}
          prospectName={prospect.name}
          onConfirm={handleStart}
          onCancel={() => {
            setShowStartDialog(false);
            setStartError(null);
          }}
          isStarting={isStarting}
          error={startError}
        />
      )}

      {/* Back Button */}
      <div className="flex items-center gap-2 mb-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="text-muted-foreground hover:text-foreground -ml-2">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
      </div>

      {/* Hero Header */}
      <div className="flex flex-col md:flex-row justify-between items-start gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">
            {steps[0]?.subject || `Sequence for ${prospect.name}`}
          </h1>
          <div className="flex items-center gap-3">
            <StatusBadge status={sequenceStatus.toLowerCase() as any} dot />
            <span className="text-muted-foreground text-sm">
              Prospect: <Link prefetch={true} href={`/prospects/${prospect.id}`} className="font-medium text-foreground hover:underline">{prospect.name}</Link>
              {prospect.company && ` (${prospect.company})`}
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          {savedSequence && (
            <Button
              variant="outline"
              onClick={() => setShowPreview(true)}
              id="preview-sequence-btn"
            >
              Preview Sequence
            </Button>
          )}

          {!isReadOnly && (
            <Button
              onClick={handleSave}
              disabled={isSaving}
              id="save-draft-btn"
            >
              {isSaving ? "Saving…" : savedSequence ? "Save Draft" : "Create Sequence"}
            </Button>
          )}

          {/* Start button — only shown for DRAFT sequences that have been saved */}
          {savedSequence && sequenceStatus === "DRAFT" && (
            <Button
              onClick={() => setShowStartDialog(true)}
              disabled={isSaving}
              id="start-sequence-btn"
              className="bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600"
            >
              🚀 Start Sequence
            </Button>
          )}
        </div>
      </div>

      {/* General error */}
      {generalError && (
        <div className="p-4 bg-destructive/10 text-destructive rounded-md" role="alert">
          {generalError}
        </div>
      )}

      {/* Steps */}
      <div className="mt-8 relative max-w-3xl">
        <div className="absolute left-6 top-8 bottom-8 w-0.5 bg-border z-0"></div>
        
        <div className="space-y-6 relative z-10">
          {steps.map((step, index) => (
            <StepEditor
              key={`${step.step_number}-${index}`}
              step={step}
              index={index}
              errors={stepErrors[index] ?? {}}
              disabled={isReadOnly || isSaving}
              onUpdate={(updated) => updateStep(index, updated)}
              onRemove={() => removeStep(index)}
              canRemove={steps.length > 1 && !isReadOnly}
              onDuplicate={() => duplicateStep(index)}
              canDuplicate={steps.length < MAX_STEPS && !isReadOnly}
              onMoveUp={() => moveStepUp(index)}
              canMoveUp={index > 0 && !isReadOnly}
              onMoveDown={() => moveStepDown(index)}
              canMoveDown={index < steps.length - 1 && !isReadOnly}
            />
          ))}
        </div>
      </div>

      {/* Add follow-up */}
      {!isReadOnly && steps.length < MAX_STEPS && (
        <Button
          variant="outline"
          onClick={addStep}
          disabled={isSaving}
          id="add-follow-up-btn"
          className="self-start"
        >
          + Add Follow-up Email
        </Button>
      )}

      {sequenceStatus === "ACTIVE" && savedSequence && (
        <div className="mt-8 p-6 bg-muted/30 border border-border rounded-lg">
          <div className="mb-6 pb-4 border-b border-border">
            <div className="font-semibold text-lg text-foreground mb-1">📬 Sequence Active — Step Status</div>
            <div className="text-sm text-muted-foreground">
              Use ⚡ Send Now to deliver a step immediately, bypassing the schedule.
            </div>
          </div>
          <div className="flex flex-col gap-4">
            {savedSequence.steps.map((dbStep) => {
              const isSent = dbStep.status === "SENT" || justSentStepIds.has(dbStep.id);
              const isFailed = dbStep.status === "FAILED";
              const isProcessing = dbStep.status === "PROCESSING";
              const isPending = dbStep.status === "PENDING" && !justSentStepIds.has(dbStep.id);
              const isCancelled = dbStep.status === "CANCELLED" || dbStep.status === "SKIPPED";

              let statusIcon = "⏳";
              if (isSent) { statusIcon = "✅"; }
              else if (isFailed) { statusIcon = "❌"; }
              else if (isProcessing) { statusIcon = "⚙️"; }
              else if (isCancelled) { statusIcon = "🚫"; }

              return (
                <div key={dbStep.id} className="flex items-center justify-between p-4 bg-background rounded-md border border-border">
                  <div className="flex items-start gap-3">
                    <span className="text-xl mt-0.5">{statusIcon}</span>
                    <div className="flex flex-col gap-1">
                      <span className="font-semibold text-foreground text-sm">
                        Step {dbStep.step_number}
                      </span>
                      <span className="text-foreground text-sm">{dbStep.subject}</span>
                      <span className="text-muted-foreground text-xs">
                        {isSent && dbStep.sent_at
                          ? `Sent ${new Date(dbStep.sent_at).toLocaleString()}`
                          : `Scheduled: ${new Date(dbStep.scheduled_at_utc).toLocaleString()}`}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {isPending && (
                      <SendNowButton
                        stepId={dbStep.id}
                        stepNumber={dbStep.step_number}
                        onSuccess={handleSendNowSuccess}
                      />
                    )}
                    {isSent && (
                      <span className="text-xs font-medium text-emerald-700 bg-emerald-500/10 px-2 py-1 rounded-full">
                        ✅ Delivered
                        {dbStep.gmail_message_id && (
                          <span className="ml-1.5 opacity-80">
                            ID: {dbStep.gmail_message_id.slice(0, 12)}…
                          </span>
                        )}
                      </span>
                    )}
                    {isFailed && (
                      <div className="flex flex-col items-end gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => sequenceId && handleRetryAndSend(dbStep.id, sequenceId)}
                          disabled={retryingStepIds.has(dbStep.id)}
                          className="border-warning text-warning"
                        >
                          {retryingStepIds.has(dbStep.id) ? "Retrying…" : "🔄 Retry & Send"}
                        </Button>
                        {retryErrors[dbStep.id] && (
                          <p className="text-xs text-destructive m-0" role="alert">
                            {retryErrors[dbStep.id]}
                          </p>
                        )}
                      </div>
                    )}
                    {isProcessing && (
                      <span className="text-xs font-medium text-blue-700 bg-blue-500/10 px-2 py-1 rounded-full">⚙️ Processing…</span>
                    )}
                    {isCancelled && (
                      <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded-full">🚫 {dbStep.status}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </AnimatedPage>
  );
}
