/**
 * Sequence Validation Tests — Phase 3
 *
 * Tests for src/lib/validations/sequence.ts
 *
 * No database, no network, no side effects.
 * Validates: step count, step numbering, field constraints,
 * IANA timezone validation, date/time formats, relative scheduling,
 * and chronological ordering.
 */

import {
  validateSequenceInput,
  isValidIanaTimezone,
  MAX_STEPS,
  MAX_SUBJECT_LENGTH,
  MAX_BODY_LENGTH,
  MAX_DELAY_DAYS,
  MIN_DELAY_DAYS,
} from "@/lib/validations/sequence";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** A valid step 1 payload */
const validStep1 = {
  step_number: 1,
  subject: "Quick question about your company",
  body: "Hi there,\n\nI came across your work and wanted to reach out.",
  send_time: "09:00",
  timezone: "America/New_York",
  send_date: "2025-06-01",
};

/** A valid step 2 payload */
const validStep2 = {
  step_number: 2,
  subject: "Re: Quick question about your company",
  body: "Just following up on my previous email.",
  send_time: "09:00",
  timezone: "America/New_York",
  delay_days: 3,
};

const validStep3 = {
  step_number: 3,
  subject: "Re: Quick question (final follow-up)",
  body: "This is my final follow-up.",
  send_time: "10:00",
  timezone: "America/New_York",
  delay_days: 5,
};

const validStep4 = {
  step_number: 4,
  subject: "Closing the loop",
  body: "Closing the loop on my earlier emails.",
  send_time: "11:00",
  timezone: "America/New_York",
  delay_days: 7,
};

// ── isValidIanaTimezone ───────────────────────────────────────────────────────

describe("isValidIanaTimezone (sequence module)", () => {
  it("accepts America/New_York", () => expect(isValidIanaTimezone("America/New_York")).toBe(true));
  it("accepts Asia/Karachi", () => expect(isValidIanaTimezone("Asia/Karachi")).toBe(true));
  it("accepts UTC", () => expect(isValidIanaTimezone("UTC")).toBe(true));
  it("rejects PST", () => expect(isValidIanaTimezone("PST")).toBe(false));
  it("rejects EST", () => expect(isValidIanaTimezone("EST")).toBe(false));
  it("rejects CST", () => expect(isValidIanaTimezone("CST")).toBe(false));
  it("rejects empty string", () => expect(isValidIanaTimezone("")).toBe(false));
  it("rejects garbage string", () => expect(isValidIanaTimezone("not-a-tz")).toBe(false));
});

// ── validateSequenceInput — valid sequences ────────────────────────────────────

describe("validateSequenceInput — valid sequences", () => {
  it("accepts a valid 1-step sequence", () => {
    const result = validateSequenceInput({ steps: [validStep1] });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.sanitizedSteps).toHaveLength(1);
  });

  it("accepts a valid 2-step sequence", () => {
    const result = validateSequenceInput({ steps: [validStep1, validStep2] });
    expect(result.valid).toBe(true);
    expect(result.sanitizedSteps).toHaveLength(2);
  });

  it("accepts a valid 4-step sequence", () => {
    const result = validateSequenceInput({
      steps: [validStep1, validStep2, validStep3, validStep4],
    });
    expect(result.valid).toBe(true);
    expect(result.sanitizedSteps).toHaveLength(4);
  });

  it("returns sanitized step with scheduled_at_utc as a Date", () => {
    const result = validateSequenceInput({ steps: [validStep1] });
    expect(result.valid).toBe(true);
    expect(result.sanitizedSteps![0].scheduled_at_utc).toBeInstanceOf(Date);
  });

  it("preserves scheduled_time_local as the send_time string", () => {
    const result = validateSequenceInput({ steps: [validStep1] });
    expect(result.sanitizedSteps![0].scheduled_time_local).toBe("09:00");
  });

  it("preserves the IANA timezone identifier", () => {
    const result = validateSequenceInput({ steps: [validStep1] });
    expect(result.sanitizedSteps![0].timezone).toBe("America/New_York");
  });

  it("stores the correct step number in sanitized output", () => {
    const result = validateSequenceInput({ steps: [validStep1, validStep2] });
    expect(result.sanitizedSteps![0].step_number).toBe(1);
    expect(result.sanitizedSteps![1].step_number).toBe(2);
  });

  it("trims whitespace from subject in sanitized output", () => {
    const result = validateSequenceInput({
      steps: [{ ...validStep1, subject: "  Hello world  " }],
    });
    expect(result.sanitizedSteps![0].subject).toBe("Hello world");
  });

  it("trims whitespace from body in sanitized output", () => {
    const result = validateSequenceInput({
      steps: [{ ...validStep1, body: "  Body content  " }],
    });
    expect(result.sanitizedSteps![0].body).toBe("Body content");
  });
});

// ── validateSequenceInput — step count ────────────────────────────────────────

describe("validateSequenceInput — step count", () => {
  it("rejects an empty steps array", () => {
    const result = validateSequenceInput({ steps: [] });
    expect(result.valid).toBe(false);
    const e = result.errors.find((e) => e.field === "steps");
    expect(e?.message).toMatch(/at least one/i);
  });

  it(`rejects more than ${MAX_STEPS} steps`, () => {
    const steps = [validStep1, validStep2, validStep3, validStep4, { ...validStep1, step_number: 5 }];
    const result = validateSequenceInput({ steps });
    expect(result.valid).toBe(false);
    const e = result.errors.find((e) => e.field === "steps");
    expect(e?.message).toMatch(/at most 4/i);
  });
});

// ── validateSequenceInput — required fields ────────────────────────────────────

describe("validateSequenceInput — subject validation", () => {
  it("rejects empty subject", () => {
    const result = validateSequenceInput({
      steps: [{ ...validStep1, subject: "" }],
    });
    expect(result.valid).toBe(false);
    const e = result.errors.find((e) => e.field === "steps.0.subject");
    expect(e).toBeDefined();
  });

  it("rejects whitespace-only subject", () => {
    const result = validateSequenceInput({
      steps: [{ ...validStep1, subject: "   " }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.find((e) => e.field === "steps.0.subject")).toBeDefined();
  });

  it(`rejects subject longer than ${MAX_SUBJECT_LENGTH} characters`, () => {
    const result = validateSequenceInput({
      steps: [{ ...validStep1, subject: "a".repeat(MAX_SUBJECT_LENGTH + 1) }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.find((e) => e.field === "steps.0.subject")).toBeDefined();
  });

  it(`accepts subject at exactly ${MAX_SUBJECT_LENGTH} characters`, () => {
    const result = validateSequenceInput({
      steps: [{ ...validStep1, subject: "a".repeat(MAX_SUBJECT_LENGTH) }],
    });
    expect(result.valid).toBe(true);
  });
});

describe("validateSequenceInput — body validation", () => {
  it("rejects empty body", () => {
    const result = validateSequenceInput({
      steps: [{ ...validStep1, body: "" }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.find((e) => e.field === "steps.0.body")).toBeDefined();
  });

  it(`rejects body longer than ${MAX_BODY_LENGTH} characters`, () => {
    const result = validateSequenceInput({
      steps: [{ ...validStep1, body: "a".repeat(MAX_BODY_LENGTH + 1) }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.find((e) => e.field === "steps.0.body")).toBeDefined();
  });

  it(`accepts body at exactly ${MAX_BODY_LENGTH} characters`, () => {
    const result = validateSequenceInput({
      steps: [{ ...validStep1, body: "a".repeat(MAX_BODY_LENGTH) }],
    });
    expect(result.valid).toBe(true);
  });
});

// ── validateSequenceInput — time validation ────────────────────────────────────

describe("validateSequenceInput — send_time validation", () => {
  it("rejects empty send_time", () => {
    const result = validateSequenceInput({
      steps: [{ ...validStep1, send_time: "" }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.find((e) => e.field === "steps.0.send_time")).toBeDefined();
  });

  it("rejects invalid time format (9:00 without leading zero)", () => {
    const result = validateSequenceInput({
      steps: [{ ...validStep1, send_time: "9:00" }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.find((e) => e.field === "steps.0.send_time")).toBeDefined();
  });

  it("rejects hour 24", () => {
    const result = validateSequenceInput({
      steps: [{ ...validStep1, send_time: "24:00" }],
    });
    expect(result.valid).toBe(false);
  });

  it("rejects 9am format", () => {
    const result = validateSequenceInput({
      steps: [{ ...validStep1, send_time: "9am" }],
    });
    expect(result.valid).toBe(false);
  });

  it("accepts 00:00 (midnight)", () => {
    const result = validateSequenceInput({
      steps: [{ ...validStep1, send_time: "00:00" }],
    });
    expect(result.valid).toBe(true);
  });

  it("accepts 23:59", () => {
    const result = validateSequenceInput({
      steps: [{ ...validStep1, send_time: "23:59" }],
    });
    expect(result.valid).toBe(true);
  });
});

// ── validateSequenceInput — timezone validation ────────────────────────────────

describe("validateSequenceInput — timezone validation", () => {
  it("rejects empty timezone", () => {
    const result = validateSequenceInput({
      steps: [{ ...validStep1, timezone: "" }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.find((e) => e.field === "steps.0.timezone")).toBeDefined();
  });

  it("rejects PST abbreviation", () => {
    const result = validateSequenceInput({
      steps: [{ ...validStep1, timezone: "PST" }],
    });
    expect(result.valid).toBe(false);
  });

  it("rejects EST abbreviation", () => {
    const result = validateSequenceInput({
      steps: [{ ...validStep1, timezone: "EST" }],
    });
    expect(result.valid).toBe(false);
  });

  it("rejects garbage string", () => {
    const result = validateSequenceInput({
      steps: [{ ...validStep1, timezone: "NotATimezone" }],
    });
    expect(result.valid).toBe(false);
  });

  it("accepts UTC", () => {
    const result = validateSequenceInput({
      steps: [{ ...validStep1, timezone: "UTC" }],
    });
    expect(result.valid).toBe(true);
  });

  it("accepts Asia/Karachi", () => {
    const result = validateSequenceInput({
      steps: [{ ...validStep1, timezone: "Asia/Karachi" }],
    });
    expect(result.valid).toBe(true);
  });
});

// ── validateSequenceInput — date validation (step 1) ─────────────────────────

describe("validateSequenceInput — send_date for step 1", () => {
  it("rejects missing send_date for step 1", () => {
    const { send_date: _, ...noDate } = validStep1;
    const result = validateSequenceInput({ steps: [noDate] });
    expect(result.valid).toBe(false);
    expect(result.errors.find((e) => e.field === "steps.0.send_date")).toBeDefined();
  });

  it("rejects invalid date format MM/DD/YYYY", () => {
    const result = validateSequenceInput({
      steps: [{ ...validStep1, send_date: "06/01/2025" }],
    });
    expect(result.valid).toBe(false);
  });

  it("rejects invalid date like 2025-13-01", () => {
    const result = validateSequenceInput({
      steps: [{ ...validStep1, send_date: "2025-13-01" }],
    });
    expect(result.valid).toBe(false);
  });

  it("rejects non-leap-year Feb 29", () => {
    const result = validateSequenceInput({
      steps: [{ ...validStep1, send_date: "2025-02-29" }],
    });
    expect(result.valid).toBe(false);
  });

  it("accepts leap year Feb 29 (2024)", () => {
    const result = validateSequenceInput({
      steps: [{ ...validStep1, send_date: "2024-02-29" }],
    });
    expect(result.valid).toBe(true);
  });
});

// ── validateSequenceInput — delay_days for steps 2-4 ─────────────────────────

describe("validateSequenceInput — delay_days for steps 2+", () => {
  it("rejects missing delay_days for step 2", () => {
    const { delay_days: _, ...noDelay } = validStep2;
    const result = validateSequenceInput({ steps: [validStep1, noDelay] });
    expect(result.valid).toBe(false);
    expect(result.errors.find((e) => e.field === "steps.1.delay_days")).toBeDefined();
  });

  it("rejects delay_days of 0", () => {
    const result = validateSequenceInput({
      steps: [validStep1, { ...validStep2, delay_days: 0 }],
    });
    expect(result.valid).toBe(false);
  });

  it(`rejects delay_days greater than ${MAX_DELAY_DAYS}`, () => {
    const result = validateSequenceInput({
      steps: [validStep1, { ...validStep2, delay_days: MAX_DELAY_DAYS + 1 }],
    });
    expect(result.valid).toBe(false);
  });

  it(`accepts delay_days of ${MIN_DELAY_DAYS} (minimum)`, () => {
    const result = validateSequenceInput({
      steps: [validStep1, { ...validStep2, delay_days: MIN_DELAY_DAYS }],
    });
    expect(result.valid).toBe(true);
  });

  it(`accepts delay_days of ${MAX_DELAY_DAYS} (maximum)`, () => {
    const result = validateSequenceInput({
      steps: [validStep1, { ...validStep2, delay_days: MAX_DELAY_DAYS }],
    });
    expect(result.valid).toBe(true);
  });

  it("rejects non-integer delay_days", () => {
    const result = validateSequenceInput({
      steps: [validStep1, { ...validStep2, delay_days: 2.5 }],
    });
    expect(result.valid).toBe(false);
  });
});

// ── validateSequenceInput — chronological ordering ────────────────────────────

describe("validateSequenceInput — chronological ordering", () => {
  it("ensures step 2 is after step 1 (valid: delay_days=1)", () => {
    const result = validateSequenceInput({
      steps: [validStep1, { ...validStep2, delay_days: 1 }],
    });
    expect(result.valid).toBe(true);
  });

  it("computes correct UTC for step 2 at 3-day delay", () => {
    const result = validateSequenceInput({ steps: [validStep1, validStep2] });
    expect(result.valid).toBe(true);
    const step1Utc = result.sanitizedSteps![0].scheduled_at_utc.getTime();
    const step2Utc = result.sanitizedSteps![1].scheduled_at_utc.getTime();
    expect(step2Utc).toBeGreaterThan(step1Utc);
    // 3-day delay = exactly 3 * 86400 * 1000 ms (same time each day)
    expect(step2Utc - step1Utc).toBe(3 * 24 * 60 * 60 * 1000);
  });

  it("correctly chains 4 steps — each UTC is after the previous", () => {
    const result = validateSequenceInput({
      steps: [validStep1, validStep2, validStep3, validStep4],
    });
    expect(result.valid).toBe(true);
    const utcs = result.sanitizedSteps!.map((s) => s.scheduled_at_utc.getTime());
    for (let i = 1; i < utcs.length; i++) {
      expect(utcs[i]).toBeGreaterThan(utcs[i - 1]);
    }
  });

  it("computes correct step dates for relative scheduling", () => {
    const result = validateSequenceInput({ steps: [validStep1, validStep2] });
    expect(result.valid).toBe(true);
    // Step 1: 2025-06-01, Step 2: 2025-06-01 + 3 days = 2025-06-04
    expect(result.sanitizedSteps![1].computed_date).toBe("2025-06-04");
  });
});

// ── validateSequenceInput — malformed inputs ──────────────────────────────────

describe("validateSequenceInput — malformed inputs", () => {
  it("rejects non-object input", () => {
    const result = validateSequenceInput("not an object");
    expect(result.valid).toBe(false);
    expect(result.errors[0].field).toBe("general");
  });

  it("rejects null input", () => {
    const result = validateSequenceInput(null);
    expect(result.valid).toBe(false);
  });

  it("rejects missing steps field", () => {
    const result = validateSequenceInput({ notSteps: [] });
    expect(result.valid).toBe(false);
    expect(result.errors.find((e) => e.field === "steps")).toBeDefined();
  });

  it("reports multiple errors simultaneously", () => {
    const result = validateSequenceInput({
      steps: [{ ...validStep1, subject: "", body: "" }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });
});
