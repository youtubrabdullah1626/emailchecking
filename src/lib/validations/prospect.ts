/**
 * Prospect Input Validation
 *
 * Pure functions — no database, no HTTP, no side effects.
 * Safe to call from both server routes and tests.
 *
 * The server route is always the authoritative validator.
 * Client-side validation may mirror these rules for UX only.
 */

import { z } from "zod";

// ── Helpers ──────────────────────────────────────────────────────────────────

const EMAIL_REGEX = /^[a-zA-Z0-9+]+([._-][a-zA-Z0-9+]+)*@[a-zA-Z0-9]+([.-][a-zA-Z0-9]+)*\.[a-zA-Z]{2,}$/;

export function isValidEmail(raw: string): boolean {
  return EMAIL_REGEX.test(raw.trim());
}

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidIanaTimezone(tz: string): boolean {
  if (!tz || typeof tz !== "string") return false;
  const normalized = tz.trim();
  if (normalized !== "UTC" && !normalized.includes("/")) {
    return false;
  }
  try {
    Intl.DateTimeFormat(undefined, { timeZone: normalized });
    return true;
  } catch {
    return false;
  }
}

// ── Schemas ──────────────────────────────────────────────────────────────────

export const prospectCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(100, "Name must be 100 characters or fewer."),
  company: z.string().trim().min(1, "Company is required.").max(100, "Company must be 100 characters or fewer."),
  email: z.string().trim().min(1, "Email address is required.")
    .refine(isValidEmail, "Enter a valid email address.")
    .transform(normalizeEmail),
  timezone: z.string().trim().min(1, "Timezone is required.")
    .refine(isValidIanaTimezone, "Select a valid timezone."),
  notes: z.string().trim().max(2000, "Notes must be 2000 characters or fewer.").optional().transform(v => v === "" ? undefined : v),
});

export const prospectUpdateSchema = prospectCreateSchema.partial();

export type ProspectCreateInput = z.infer<typeof prospectCreateSchema>;
export type ProspectUpdateInput = z.infer<typeof prospectUpdateSchema>;

export interface FieldError {
  field: string;
  message: string;
}

export interface ValidationResult<T = ProspectCreateInput | ProspectUpdateInput> {
  valid: boolean;
  errors: FieldError[];
  sanitized?: T;
}

// ── Validators ───────────────────────────────────────────────────────────────

function formatZodErrors(error: z.ZodError): FieldError[] {
  return error.issues.map((err: z.ZodIssue) => ({
    field: err.path.join('.') || "general",
    message: err.message,
  }));
}

export function validateProspectCreate(raw: unknown): ValidationResult<ProspectCreateInput> {
  const result = prospectCreateSchema.safeParse(raw);
  if (!result.success) {
    return { valid: false, errors: formatZodErrors(result.error) };
  }
  return { valid: true, errors: [], sanitized: result.data as ProspectCreateInput };
}

export function validateProspectUpdate(raw: unknown): ValidationResult<ProspectUpdateInput> {
  const result = prospectUpdateSchema.safeParse(raw);
  if (!result.success) {
    return { valid: false, errors: formatZodErrors(result.error) };
  }
  return { valid: true, errors: [], sanitized: result.data as ProspectUpdateInput };
}
