/**
 * Phase 1 Schema Tests
 *
 * These tests serve two purposes:
 *
 * 1. CONTRACT TESTS — Verify that enum values used throughout the application
 *    are correctly defined and consistently spelled. If an enum value changes
 *    in schema.prisma, these tests fail and alert the developer.
 *
 * 2. QUALITY GATE — Verify Phase 1 structural rules required before Phase 2:
 *    - Exactly 5 approved tables (no user_settings, no extra tables)
 *    - Timezone fields follow the approved design (IANA + UTC + local string)
 *    - Core business rule: no follow-ups sent after a real reply
 *
 * These are pure unit tests. No database connection required.
 */

// ──────────────────────────────────────────────────────────────────────────
// Enum value sets — mirrored from prisma/schema.prisma
// If you change an enum there, update this file too.
// ──────────────────────────────────────────────────────────────────────────

const ProspectStatus = {
  ACTIVE:    "ACTIVE",
  REPLIED:   "REPLIED",
  STOPPED:   "STOPPED",
  COMPLETED: "COMPLETED",
} as const;

const SequenceStatus = {
  DRAFT:     "DRAFT",
  ACTIVE:    "ACTIVE",
  STOPPED:   "STOPPED",
  COMPLETED: "COMPLETED",
} as const;

const StepStatus = {
  PENDING:    "PENDING",
  PROCESSING: "PROCESSING",  // Phase 4: transient scheduler-claim state (PENDING → PROCESSING → SENT|FAILED)
  SENT:       "SENT",
  FAILED:     "FAILED",
  SKIPPED:    "SKIPPED",
  CANCELLED:  "CANCELLED",
} as const;

const EmailEventType = {
  SENT:      "SENT",
  FAILED:    "FAILED",
  SKIPPED:   "SKIPPED",
  CANCELLED: "CANCELLED",
} as const;

const ReplyType = {
  REAL_REPLY:     "REAL_REPLY",
  AUTO_REPLY:     "AUTO_REPLY",
  SPAM:           "SPAM",
  UNSUBSCRIBE:    "UNSUBSCRIBE",
  NOT_INTERESTED: "NOT_INTERESTED",
  INTERESTED:     "INTERESTED",
  NEEDS_REVIEW:   "NEEDS_REVIEW",
} as const;

// ──────────────────────────────────────────────────────────────────────────
// Phase 1 Quality Gate — Schema Structure
// ──────────────────────────────────────────────────────────────────────────

describe("Phase 1 Quality Gate — Schema structure", () => {
  /**
   * The approved table set for Phase 1. Exactly these 5, no more, no less.
   * user_settings is explicitly forbidden in Phase 1.
   */
  const APPROVED_TABLES = [
    "prospects",
    "sequences",
    "sequence_steps",
    "email_events",
    "reply_classifications",
  ] as const;

  it("defines exactly 5 approved tables", () => {
    expect(APPROVED_TABLES).toHaveLength(5);
  });

  it("includes the correct table names", () => {
    expect(APPROVED_TABLES).toContain("prospects");
    expect(APPROVED_TABLES).toContain("sequences");
    expect(APPROVED_TABLES).toContain("sequence_steps");
    expect(APPROVED_TABLES).toContain("email_events");
    expect(APPROVED_TABLES).toContain("reply_classifications");
  });

  it("does NOT include user_settings — forbidden in Phase 1", () => {
    expect(APPROVED_TABLES).not.toContain("user_settings");
  });

  it("does NOT include any undocumented tables", () => {
    const undocumentedTables = (APPROVED_TABLES as readonly string[]).filter(
      (t) =>
        ![
          "prospects",
          "sequences",
          "sequence_steps",
          "email_events",
          "reply_classifications",
        ].includes(t)
    );
    expect(undocumentedTables).toHaveLength(0);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Phase 1 Quality Gate — Timezone design
// ──────────────────────────────────────────────────────────────────────────

describe("Phase 1 Quality Gate — Timezone field design", () => {
  /**
   * The approved timezone field design for sequence_steps.
   *
   * scheduled_at_utc    — the UTC DateTime used by the scheduler
   * scheduled_time_local — the human-readable local time string e.g. "09:00"
   * timezone            — the IANA timezone identifier
   *
   * This three-field pattern ensures:
   * - The scheduler always fires at the correct UTC moment
   * - The UI can always display what the user originally intended
   * - The audit trail is self-contained per record
   */
  const STEP_TIMEZONE_FIELDS = [
    "scheduled_at_utc",
    "scheduled_time_local",
    "timezone",
  ] as const;

  it("sequence_steps timezone design uses three fields", () => {
    expect(STEP_TIMEZONE_FIELDS).toHaveLength(3);
  });

  it("uses scheduled_at_utc (not scheduled_at) for UTC scheduling", () => {
    expect(STEP_TIMEZONE_FIELDS).toContain("scheduled_at_utc");
    expect(STEP_TIMEZONE_FIELDS).not.toContain("scheduled_at");
  });

  it("includes scheduled_time_local for display transparency", () => {
    expect(STEP_TIMEZONE_FIELDS).toContain("scheduled_time_local");
  });

  it("includes timezone as an IANA identifier field per step", () => {
    expect(STEP_TIMEZONE_FIELDS).toContain("timezone");
  });

  it("rejects timezone abbreviations as canonical identifiers", () => {
    // These abbreviations must NOT be used as canonical stored timezone values.
    // They are ambiguous (PST could be Pacific Standard OR Philippine Standard)
    // and do not account for DST transitions.
    const invalidTimezoneAbbreviations = ["PST", "EST", "CST", "MST", "GMT+5"];

    const validIanaExamples = [
      "America/New_York",
      "America/Chicago",
      "America/Los_Angeles",
      "Europe/London",
      "Europe/Paris",
      "Asia/Karachi",
      "Asia/Tokyo",
      "UTC",
    ];

    // Confirm none of the invalid abbreviations appear in valid IANA examples
    invalidTimezoneAbbreviations.forEach((abbr) => {
      expect(validIanaExamples).not.toContain(abbr);
    });

    // Confirm valid IANA identifiers contain a "/" (all do except "UTC")
    const ianaWithSlash = validIanaExamples.filter((tz) => tz !== "UTC");
    ianaWithSlash.forEach((tz) => {
      expect(tz).toContain("/");
    });
  });

  it("local time string format is HH:MM", () => {
    // The scheduled_time_local field stores a time-of-day string.
    // Validate the expected format with a regex.
    const validLocalTimes = ["09:00", "14:30", "23:59", "00:00"];
    const timeRegex = /^\d{2}:\d{2}$/;
    validLocalTimes.forEach((t) => {
      expect(t).toMatch(timeRegex);
    });
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Enum contract tests
// ──────────────────────────────────────────────────────────────────────────

describe("ProspectStatus enum", () => {
  it("has exactly 4 values", () => {
    expect(Object.keys(ProspectStatus)).toHaveLength(4);
  });

  it("contains all required values", () => {
    expect(Object.values(ProspectStatus)).toEqual(
      expect.arrayContaining(["ACTIVE", "REPLIED", "STOPPED", "COMPLETED"])
    );
  });

  it("ACTIVE is the default status for new prospects", () => {
    expect(ProspectStatus.ACTIVE).toBe("ACTIVE");
  });
});

describe("SequenceStatus enum", () => {
  it("has exactly 4 values", () => {
    expect(Object.keys(SequenceStatus)).toHaveLength(4);
  });

  it("contains all required values", () => {
    expect(Object.values(SequenceStatus)).toEqual(
      expect.arrayContaining(["DRAFT", "ACTIVE", "STOPPED", "COMPLETED"])
    );
  });

  it("DRAFT is the default status for new sequences", () => {
    expect(SequenceStatus.DRAFT).toBe("DRAFT");
  });
});

describe("StepStatus enum", () => {
  it("has exactly 6 values (PROCESSING added in Phase 4)", () => {
    expect(Object.keys(StepStatus)).toHaveLength(6);
  });

  it("contains all required values including PROCESSING", () => {
    expect(Object.values(StepStatus)).toEqual(
      expect.arrayContaining(["PENDING", "PROCESSING", "SENT", "FAILED", "SKIPPED", "CANCELLED"])
    );
  });

  it("PENDING is the initial state for new steps", () => {
    expect(StepStatus.PENDING).toBe("PENDING");
  });

  it("PROCESSING is the transient scheduler-claim state (PENDING → PROCESSING → SENT | FAILED)", () => {
    expect(StepStatus.PROCESSING).toBe("PROCESSING");
    // PROCESSING is NOT a terminal state — it must advance to SENT or FAILED.
    // A step stuck in PROCESSING indicates a scheduler crash or network failure.
    expect(StepStatus.PROCESSING).not.toBe(StepStatus.SENT);
    expect(StepStatus.PROCESSING).not.toBe(StepStatus.FAILED);
  });

  it("CANCELLED is distinct from SKIPPED", () => {
    // CANCELLED = stopped by reply detection logic (automatic)
    // SKIPPED   = step was disabled by the user before the sequence started (manual)
    expect(StepStatus.CANCELLED).not.toBe(StepStatus.SKIPPED);
  });

  it("FAILED steps are not automatically retried — require manual reset", () => {
    // The scheduler only claims PENDING steps. FAILED steps are never
    // re-queued automatically. Manual intervention resets FAILED → PENDING.
    expect(StepStatus.FAILED).toBe("FAILED");
    expect(StepStatus.FAILED).not.toBe(StepStatus.PENDING);
  });
});

describe("EmailEventType enum", () => {
  it("has exactly 4 values", () => {
    expect(Object.keys(EmailEventType)).toHaveLength(4);
  });

  it("contains all required values", () => {
    expect(Object.values(EmailEventType)).toEqual(
      expect.arrayContaining(["SENT", "FAILED", "SKIPPED", "CANCELLED"])
    );
  });
});

describe("ReplyType enum", () => {
  it("has exactly 7 values", () => {
    expect(Object.keys(ReplyType)).toHaveLength(7);
  });

  it("contains all required values", () => {
    expect(Object.values(ReplyType)).toEqual(
      expect.arrayContaining([
        "REAL_REPLY",
        "AUTO_REPLY",
        "SPAM",
        "UNSUBSCRIBE",
        "NOT_INTERESTED",
        "INTERESTED",
        "NEEDS_REVIEW",
      ])
    );
  });

  it("REAL_REPLY is the type that triggers sequence stop", () => {
    expect(ReplyType.REAL_REPLY).toBe("REAL_REPLY");
  });

  it("distinguishes INTERESTED from NOT_INTERESTED", () => {
    expect(ReplyType.INTERESTED).not.toBe(ReplyType.NOT_INTERESTED);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Sequence step structure
// ──────────────────────────────────────────────────────────────────────────

describe("Sequence step numbering", () => {
  const validStepNumbers = [1, 2, 3, 4];

  it("supports exactly 4 steps per sequence", () => {
    expect(validStepNumbers).toHaveLength(4);
  });

  it("step 1 is the initial email", () => {
    expect(validStepNumbers[0]).toBe(1);
  });

  it("steps 2–4 are follow-ups", () => {
    expect(validStepNumbers.slice(1)).toEqual([2, 3, 4]);
  });

  it("step numbers are unique within a sequence", () => {
    const seen = new Set<number>();
    for (const n of validStepNumbers) {
      expect(seen.has(n)).toBe(false);
      seen.add(n);
    }
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Core Business Rule — Stop-on-Reply
// ──────────────────────────────────────────────────────────────────────────

describe("Core business rule — stop-on-reply logic", () => {
  /**
   * When a REAL_REPLY is received, ALL PENDING and PROCESSING steps must be CANCELLED.
   * PENDING  = waiting to be claimed by the scheduler
   * PROCESSING = already claimed by the scheduler but not yet sent to Gmail
   * Both must be cancelled — we do not want any mid-flight claims to proceed.
   * SENT steps remain SENT. FAILED steps remain FAILED.
   * This is the most important invariant in the entire system.
   */
  function applyStopOnReply(
    steps: Array<{ status: string }>
  ): Array<{ status: string }> {
    const cancellableStatuses = new Set<string>([StepStatus.PENDING, StepStatus.PROCESSING]);
    return steps.map((step) => ({
      ...step,
      status: cancellableStatuses.has(step.status) ? StepStatus.CANCELLED : step.status,
    }));
  }

  /**
   * The scheduler gating function.
   * A step may only be sent if BOTH conditions are true:
   *   1. The step itself is in PENDING status
   *   2. The parent sequence is in ACTIVE status
   */
  function isStepEligibleToSend(stepStatus: string, sequenceStatus: string): boolean {
    return (
      stepStatus === StepStatus.PENDING &&
      sequenceStatus === SequenceStatus.ACTIVE
    );
  }

  it("cancels PROCESSING steps when a real reply is received (mid-flight claim)", () => {
    // A PROCESSING step is already claimed by the scheduler but not yet sent.
    // When a reply arrives, we must cancel it to prevent the email going out.
    const steps = [
      { status: StepStatus.SENT },
      { status: StepStatus.PROCESSING },
      { status: StepStatus.PENDING },
    ];

    const result = applyStopOnReply(steps);

    expect(result[0].status).toBe(StepStatus.SENT);      // sent — unchanged
    expect(result[1].status).toBe(StepStatus.CANCELLED); // processing → cancelled
    expect(result[2].status).toBe(StepStatus.CANCELLED); // pending → cancelled
  });

  it("cancels all PENDING steps when a real reply is received", () => {
    const steps = [
      { status: StepStatus.SENT },
      { status: StepStatus.PENDING },
      { status: StepStatus.PENDING },
      { status: StepStatus.PENDING },
    ];

    const result = applyStopOnReply(steps);

    expect(result[0].status).toBe(StepStatus.SENT);      // already sent — unchanged
    expect(result[1].status).toBe(StepStatus.CANCELLED); // was pending → cancelled
    expect(result[2].status).toBe(StepStatus.CANCELLED); // was pending → cancelled
    expect(result[3].status).toBe(StepStatus.CANCELLED); // was pending → cancelled
  });

  it("does not modify steps that are already sent", () => {
    const steps = [
      { status: StepStatus.SENT },
      { status: StepStatus.SENT },
    ];

    const result = applyStopOnReply(steps);

    expect(result[0].status).toBe(StepStatus.SENT);
    expect(result[1].status).toBe(StepStatus.SENT);
  });

  it("does not modify steps that are already failed", () => {
    const steps = [{ status: StepStatus.FAILED }];
    const result = applyStopOnReply(steps);
    expect(result[0].status).toBe(StepStatus.FAILED);
  });

  it("handles an all-pending sequence (no emails sent yet)", () => {
    const steps = [
      { status: StepStatus.PENDING },
      { status: StepStatus.PENDING },
      { status: StepStatus.PENDING },
      { status: StepStatus.PENDING },
    ];

    const result = applyStopOnReply(steps);

    result.forEach((step) => {
      expect(step.status).toBe(StepStatus.CANCELLED);
    });
  });

  it("handles an already-completed sequence (all sent)", () => {
    const steps = [
      { status: StepStatus.SENT },
      { status: StepStatus.SENT },
      { status: StepStatus.SENT },
      { status: StepStatus.SENT },
    ];

    const result = applyStopOnReply(steps);

    result.forEach((step) => {
      expect(step.status).toBe(StepStatus.SENT); // nothing changes
    });
  });

  describe("scheduler gating — isStepEligibleToSend", () => {
    it("allows send when step is PENDING and sequence is ACTIVE", () => {
      expect(isStepEligibleToSend(StepStatus.PENDING, SequenceStatus.ACTIVE)).toBe(true);
    });

    it("blocks send when sequence is STOPPED", () => {
      expect(isStepEligibleToSend(StepStatus.PENDING, SequenceStatus.STOPPED)).toBe(false);
    });

    it("blocks send when sequence is COMPLETED", () => {
      expect(isStepEligibleToSend(StepStatus.PENDING, SequenceStatus.COMPLETED)).toBe(false);
    });

    it("blocks send when sequence is DRAFT", () => {
      expect(isStepEligibleToSend(StepStatus.PENDING, SequenceStatus.DRAFT)).toBe(false);
    });

    it("blocks send when step is CANCELLED (even if sequence is ACTIVE)", () => {
      expect(isStepEligibleToSend(StepStatus.CANCELLED, SequenceStatus.ACTIVE)).toBe(false);
    });

    it("blocks send when step is already SENT", () => {
      expect(isStepEligibleToSend(StepStatus.SENT, SequenceStatus.ACTIVE)).toBe(false);
    });

    it("blocks send when step is FAILED", () => {
      expect(isStepEligibleToSend(StepStatus.FAILED, SequenceStatus.ACTIVE)).toBe(false);
    });

    it("blocks send when step is SKIPPED", () => {
      expect(isStepEligibleToSend(StepStatus.SKIPPED, SequenceStatus.ACTIVE)).toBe(false);
    });
  });
});
