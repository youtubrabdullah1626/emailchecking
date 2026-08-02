/**
 * Sequence Input Validation
 *
 * Pure functions — no database, no HTTP, no side effects.
 * The server route is always the authoritative validator.
 *
 * Validates the sequence structure and each step's scheduling data.
 * Computes scheduled_at_utc for all steps so the DB layer stores ready values.
 */

import {
  isValidDateString,
  isValidTimeString,
  localToUtc,
  addDays,
} from "@/lib/scheduling";
import type { FieldError } from "@/lib/validations/prospect";

export type { FieldError };

// ── Constants ─────────────────────────────────────────────────────────────────

export const MAX_STEPS = 4;
export const MIN_DELAY_DAYS = 1;
export const MAX_DELAY_DAYS = 365;
export const MAX_SUBJECT_LENGTH = 200;
export const MAX_BODY_LENGTH = 10_000;

// ── Input types ───────────────────────────────────────────────────────────────

export interface StepInput {
  step_number: number;
  subject: string;
  body: string;
  send_time: string;    // "HH:MM" 24-hour
  timezone: string;     // IANA identifier
  send_date?: string;   // "YYYY-MM-DD" — required for step 1
  delay_days?: number;  // integer ≥ 1  — required for steps 2–4
}

export interface SequenceInput {
  steps: StepInput[];
}

export interface SanitizedStep {
  step_number: number;
  subject: string;
  body: string;
  scheduled_at_utc: Date;
  scheduled_time_local: string; // "HH:MM" — stored for display transparency
  timezone: string;
  computed_date: string;        // "YYYY-MM-DD" — the local calendar date
}

export interface SequenceValidationResult {
  valid: boolean;
  errors: FieldError[];
  sanitizedSteps?: SanitizedStep[];
}

// ── IANA timezone check (slash-rule + Intl) ───────────────────────────────────

/**
 * Validates a timezone as a canonical IANA identifier.
 * Rejects PST/EST/CST abbreviations that some ICU builds incorrectly accept.
 */
export function isValidIanaTimezone(tz: string): boolean {
  if (!tz || typeof tz !== "string") return false;
  const normalized = tz.trim();
  if (normalized !== "UTC" && !normalized.includes("/")) return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: normalized });
    return true;
  } catch {
    return false;
  }
}

import { z } from "zod";

// ── Per-step validator ────────────────────────────────────────────────────────

const stepBaseSchema = z.object({
  subject: z.string().trim().min(1, "Subject is required.").max(MAX_SUBJECT_LENGTH, `Subject must be ${MAX_SUBJECT_LENGTH} characters or fewer.`),
  body: z.string().trim().min(1, "Body is required.").max(MAX_BODY_LENGTH, `Body must be ${MAX_BODY_LENGTH} characters or fewer.`),
  send_time: z.string().trim().min(1, "Send time is required.")
    .refine(isValidTimeString, "Enter a valid 24-hour time (HH:MM)."),
  timezone: z.string().trim().min(1, "Timezone is required.")
    .refine(isValidIanaTimezone, "Select a valid IANA timezone."),
  send_date: z.string().trim().optional(),
  delay_days: z.number().int().optional()
});

function validateStep(
  raw: unknown,
  index: number,
  resolvedPreviousDate: string | null
): {
  errors: FieldError[];
  sanitized?: SanitizedStep;
  resolvedDate?: string;
} {
  const emailLabel = `Email ${index + 1}`;
  const result = stepBaseSchema.safeParse(raw);
  
  if (!result.success) {
    return {
      errors: result.error.issues.map((e: z.ZodIssue) => ({
        field: `steps.${index}.${e.path.join('.')}`,
        message: `${emailLabel}: ${e.message}`
      }))
    };
  }

  const s = result.data;
  const errors: FieldError[] = [];
  const pfx = `steps.${index}`;

  // Date resolution
  let resolvedDate: string | undefined;

  if (index === 0) {
    // Step 1 — needs an absolute send_date
    const send_date = typeof s.send_date === "string" ? s.send_date.trim() : "";
    if (!send_date) {
      errors.push({ field: `${pfx}.send_date`, message: `${emailLabel}: Send date is required.` });
    } else if (!isValidDateString(send_date)) {
      errors.push({ field: `${pfx}.send_date`, message: `${emailLabel}: Enter a valid date (YYYY-MM-DD).` });
    } else {
      resolvedDate = send_date;
    }
  } else {
    // Steps 2–4 — delay from previous
    const delay = s.delay_days;

    if (delay === undefined || delay === null) {
      errors.push({ field: `${pfx}.delay_days`, message: `${emailLabel}: Delay days is required.` });
    } else if (!Number.isInteger(delay) || delay < MIN_DELAY_DAYS || delay > MAX_DELAY_DAYS) {
      errors.push({
        field: `${pfx}.delay_days`,
        message: `${emailLabel}: Delay must be between ${MIN_DELAY_DAYS} and ${MAX_DELAY_DAYS} days.`,
      });
    } else if (resolvedPreviousDate) {
      resolvedDate = addDays(resolvedPreviousDate, delay);
    }
  }

  if (errors.length > 0) return { errors };

  // All fields valid — compute the UTC datetime
  const utcDate = localToUtc(resolvedDate!, s.send_time, s.timezone);

  return {
    errors: [],
    sanitized: {
      step_number: index + 1,
      subject: s.subject,
      body: s.body,
      scheduled_at_utc: utcDate,
      scheduled_time_local: s.send_time,
      timezone: s.timezone,
      computed_date: resolvedDate!,
    },
    resolvedDate,
  };
}

// ── Main validator ────────────────────────────────────────────────────────────

export function validateSequenceInput(raw: unknown): SequenceValidationResult {
  if (!raw || typeof raw !== "object") {
    return { valid: false, errors: [{ field: "general", message: "Invalid request body." }] };
  }

  const data = raw as Record<string, unknown>;

  if (!Array.isArray(data.steps)) {
    return { valid: false, errors: [{ field: "steps", message: "Steps must be an array." }] };
  }

  const rawSteps: unknown[] = data.steps;

  if (rawSteps.length === 0) {
    return { valid: false, errors: [{ field: "steps", message: "At least one email step is required." }] };
  }
  if (rawSteps.length > MAX_STEPS) {
    return {
      valid: false,
      errors: [{ field: "steps", message: `A sequence can have at most ${MAX_STEPS} steps.` }],
    };
  }

  // Validate each step, threading the resolved date for relative scheduling
  const errors: FieldError[] = [];
  const sanitizedSteps: SanitizedStep[] = [];
  let previousResolvedDate: string | null = null;

  for (let i = 0; i < rawSteps.length; i++) {
    const result = validateStep(rawSteps[i], i, previousResolvedDate);
    if (result.errors.length > 0) {
      errors.push(...result.errors);
    } else if (result.sanitized) {
      sanitizedSteps.push(result.sanitized);
      previousResolvedDate = result.resolvedDate ?? null;
    }
  }

  if (errors.length > 0) return { valid: false, errors };

  // Chronological ordering — each step must be strictly after the previous
  for (let i = 1; i < sanitizedSteps.length; i++) {
    if (
      sanitizedSteps[i].scheduled_at_utc.getTime() <=
      sanitizedSteps[i - 1].scheduled_at_utc.getTime()
    ) {
      errors.push({
        field: `steps.${i}.delay_days`,
        message: `Email ${i + 1} must be scheduled strictly after Email ${i}.`,
      });
    }
  }

  if (errors.length > 0) return { valid: false, errors };

  return { valid: true, errors: [], sanitizedSteps };
}
