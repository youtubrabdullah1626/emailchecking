/**
 * Phase 2 — Prospect Validation Tests
 *
 * Tests for the pure validation functions in src/lib/validations/prospect.ts
 *
 * No database. No network. No side effects.
 * All functions are deterministic and safe to test in isolation.
 */

import {
  validateProspectCreate,
  validateProspectUpdate,
  isValidEmail,
  normalizeEmail,
  isValidIanaTimezone,
} from "@/lib/validations/prospect";

// ── isValidEmail ──────────────────────────────────────────────────────────────

describe("isValidEmail", () => {
  it("accepts a standard email address", () => {
    expect(isValidEmail("jane@example.com")).toBe(true);
  });

  it("accepts email with subdomain", () => {
    expect(isValidEmail("jane@mail.example.com")).toBe(true);
  });

  it("accepts email with + alias", () => {
    expect(isValidEmail("jane+work@example.com")).toBe(true);
  });

  it("rejects empty string", () => {
    expect(isValidEmail("")).toBe(false);
  });

  it("rejects address without @", () => {
    expect(isValidEmail("notanemail")).toBe(false);
  });

  it("rejects address without domain", () => {
    expect(isValidEmail("jane@")).toBe(false);
  });

  it("rejects address without TLD", () => {
    expect(isValidEmail("jane@example")).toBe(false);
  });

  it("rejects address with spaces", () => {
    expect(isValidEmail("jane @example.com")).toBe(false);
  });
});

// ── normalizeEmail ────────────────────────────────────────────────────────────

describe("normalizeEmail", () => {
  it("lowercases the email", () => {
    expect(normalizeEmail("JANE@EXAMPLE.COM")).toBe("jane@example.com");
  });

  it("trims leading and trailing whitespace", () => {
    expect(normalizeEmail("  jane@example.com  ")).toBe("jane@example.com");
  });

  it("lowercases only — does not alter the local part unexpectedly", () => {
    // Normalizing Jane.Smith@Example.COM should preserve the dot
    expect(normalizeEmail("Jane.Smith@Example.COM")).toBe("jane.smith@example.com");
  });
});

// ── isValidIanaTimezone ───────────────────────────────────────────────────────

describe("isValidIanaTimezone", () => {
  it("accepts America/New_York", () => {
    expect(isValidIanaTimezone("America/New_York")).toBe(true);
  });

  it("accepts Europe/London", () => {
    expect(isValidIanaTimezone("Europe/London")).toBe(true);
  });

  it("accepts Asia/Karachi", () => {
    expect(isValidIanaTimezone("Asia/Karachi")).toBe(true);
  });

  it("accepts UTC", () => {
    expect(isValidIanaTimezone("UTC")).toBe(true);
  });

  it("rejects PST (ambiguous abbreviation)", () => {
    expect(isValidIanaTimezone("PST")).toBe(false);
  });

  it("rejects EST (ambiguous abbreviation)", () => {
    expect(isValidIanaTimezone("EST")).toBe(false);
  });

  it("rejects CST (ambiguous abbreviation)", () => {
    expect(isValidIanaTimezone("CST")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidIanaTimezone("")).toBe(false);
  });

  it("rejects random string", () => {
    expect(isValidIanaTimezone("not-a-timezone")).toBe(false);
  });

  it("rejects null-like undefined input", () => {
    // TypeScript won't allow this directly, but testing the guard
    expect(isValidIanaTimezone(undefined as unknown as string)).toBe(false);
  });
});

// ── validateProspectCreate ────────────────────────────────────────────────────

describe("validateProspectCreate", () => {
  const valid = {
    name: "Jane Smith",
    company: "Acme Corp",
    email: "jane@acme.com",
    timezone: "America/New_York",
  };

  it("accepts a complete valid input", () => {
    const result = validateProspectCreate(valid);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("accepts optional notes when provided", () => {
    const result = validateProspectCreate({ ...valid, notes: "Met at conference." });
    expect(result.valid).toBe(true);
    expect(result.sanitized?.notes).toBe("Met at conference.");
  });

  it("normalizes email to lowercase in sanitized output", () => {
    const result = validateProspectCreate({ ...valid, email: "Jane@ACME.COM" });
    expect(result.valid).toBe(true);
    expect(result.sanitized?.email).toBe("jane@acme.com");
  });

  it("trims whitespace from name in sanitized output", () => {
    const result = validateProspectCreate({ ...valid, name: "  Jane Smith  " });
    expect(result.valid).toBe(true);
    expect(result.sanitized?.name).toBe("Jane Smith");
  });

  it("returns error when name is missing", () => {
    const result = validateProspectCreate({ ...valid, name: "" });
    expect(result.valid).toBe(false);
    const nameError = result.errors.find((e) => e.field === "name");
    expect(nameError).toBeDefined();
  });

  it("returns error when company is missing", () => {
    const result = validateProspectCreate({ ...valid, company: "" });
    expect(result.valid).toBe(false);
    const companyError = result.errors.find((e) => e.field === "company");
    expect(companyError).toBeDefined();
  });

  it("returns error when email is missing", () => {
    const result = validateProspectCreate({ ...valid, email: "" });
    expect(result.valid).toBe(false);
    const emailError = result.errors.find((e) => e.field === "email");
    expect(emailError).toBeDefined();
  });

  it("returns error when email is invalid format", () => {
    const result = validateProspectCreate({ ...valid, email: "not-an-email" });
    expect(result.valid).toBe(false);
    const emailError = result.errors.find((e) => e.field === "email");
    expect(emailError).toBeDefined();
  });

  it("returns error when timezone is missing", () => {
    const result = validateProspectCreate({ ...valid, timezone: "" });
    expect(result.valid).toBe(false);
    const tzError = result.errors.find((e) => e.field === "timezone");
    expect(tzError).toBeDefined();
  });

  it("returns error when timezone is an abbreviation like PST", () => {
    const result = validateProspectCreate({ ...valid, timezone: "PST" });
    expect(result.valid).toBe(false);
    const tzError = result.errors.find((e) => e.field === "timezone");
    expect(tzError).toBeDefined();
  });

  it("returns error when timezone is an abbreviation like EST", () => {
    const result = validateProspectCreate({ ...valid, timezone: "EST" });
    expect(result.valid).toBe(false);
  });

  it("returns multiple field errors simultaneously", () => {
    const result = validateProspectCreate({ name: "", company: "", email: "", timezone: "" });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(4);
  });

  it("returns a general error for non-object input", () => {
    const result = validateProspectCreate("not an object");
    expect(result.valid).toBe(false);
    expect(result.errors[0].field).toBe("general");
  });

  it("returns a general error for null input", () => {
    const result = validateProspectCreate(null);
    expect(result.valid).toBe(false);
  });

  it("returns error when name exceeds 100 characters", () => {
    const result = validateProspectCreate({ ...valid, name: "a".repeat(101) });
    expect(result.valid).toBe(false);
    const nameError = result.errors.find((e) => e.field === "name");
    expect(nameError).toBeDefined();
  });

  it("returns error when notes exceed 2000 characters", () => {
    const result = validateProspectCreate({ ...valid, notes: "a".repeat(2001) });
    expect(result.valid).toBe(false);
    const notesError = result.errors.find((e) => e.field === "notes");
    expect(notesError).toBeDefined();
  });

  it("omits notes from sanitized output when empty string provided", () => {
    const result = validateProspectCreate({ ...valid, notes: "" });
    expect(result.valid).toBe(true);
    expect(result.sanitized?.notes).toBeUndefined();
  });
});

// ── validateProspectUpdate ────────────────────────────────────────────────────

describe("validateProspectUpdate", () => {
  it("accepts an empty update object (no-op update is valid)", () => {
    const result = validateProspectUpdate({});
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("accepts updating name only", () => {
    const result = validateProspectUpdate({ name: "John Doe" });
    expect(result.valid).toBe(true);
    expect(result.sanitized?.name).toBe("John Doe");
  });

  it("accepts updating email only with normalization", () => {
    const result = validateProspectUpdate({ email: "JOHN@EXAMPLE.COM" });
    expect(result.valid).toBe(true);
    expect(result.sanitized?.email).toBe("john@example.com");
  });

  it("accepts updating timezone only with valid IANA value", () => {
    const result = validateProspectUpdate({ timezone: "Europe/London" });
    expect(result.valid).toBe(true);
  });

  it("returns error when updating name to empty string", () => {
    const result = validateProspectUpdate({ name: "" });
    expect(result.valid).toBe(false);
    const nameError = result.errors.find((e) => e.field === "name");
    expect(nameError).toBeDefined();
  });

  it("returns error when updating email to invalid format", () => {
    const result = validateProspectUpdate({ email: "bad-email" });
    expect(result.valid).toBe(false);
    const emailError = result.errors.find((e) => e.field === "email");
    expect(emailError).toBeDefined();
  });

  it("returns error when updating timezone to PST abbreviation", () => {
    const result = validateProspectUpdate({ timezone: "PST" });
    expect(result.valid).toBe(false);
    const tzError = result.errors.find((e) => e.field === "timezone");
    expect(tzError).toBeDefined();
  });

  it("returns general error for non-object input", () => {
    const result = validateProspectUpdate(42);
    expect(result.valid).toBe(false);
    expect(result.errors[0].field).toBe("general");
  });
});
