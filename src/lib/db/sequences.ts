/**
 * Database access layer — Sequences and SequenceSteps
 *
 * Single authoritative source for all reads/writes to the `sequences`
 * and `sequence_steps` tables. Steps are always managed through their
 * parent sequence — never independently.
 *
 * All functions are server-side only.
 */

import prisma from "@/lib/prisma";
import type { Sequence, SequenceStep, SequenceStatus } from "@prisma/client";
import type { SanitizedStep } from "@/lib/validations/sequence";
import { errorTracker } from "@/lib/observability/errors";
import { auditService } from "@/lib/audit/audit.service";
import { getSessionUser } from "@/lib/audit/rbac";

// ── Types ────────────────────────────────────────────────────────────────────

export type SequenceWithSteps = Sequence & { steps: SequenceStep[] };

export type DbResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: "NOT_FOUND" | "DUPLICATE_SEQUENCE" | "INVALID_STATE" | "DB_ERROR";
      message: string;
    };

// ── Error classification ──────────────────────────────────────────────────────

function isDuplicateError(e: unknown): boolean {
  return (
    typeof e === "object" && e !== null && "code" in e &&
    (e as { code: string }).code === "P2002"
  );
}

function isNotFoundError(e: unknown): boolean {
  return (
    typeof e === "object" && e !== null && "code" in e &&
    (e as { code: string }).code === "P2025"
  );
}

// ── Read ─────────────────────────────────────────────────────────────────────

/**
 * Get the sequence for a prospect (if any).
 * Returns NOT_FOUND if no sequence exists for this prospect.
 */
export async function getProspectSequence(
  prospectId: string
): Promise<DbResult<SequenceWithSteps>> {
  return getLatestSequence(prospectId);
}

/**
 * Get the active sequence for a prospect (if any).
 * Returns NOT_FOUND if no ACTIVE or DRAFT sequence exists for this prospect.
 */
export async function getActiveSequence(
  prospectId: string
): Promise<DbResult<SequenceWithSteps>> {
  try {
    const sequence = await prisma.sequence.findFirst({
      where: { 
        prospect_id: prospectId,
        status: { in: ["ACTIVE", "DRAFT"] }
      },
      orderBy: { created_at: "desc" },
      include: { steps: { orderBy: { step_number: "asc" } } },
    });
    if (!sequence) {
      return { ok: false, error: "NOT_FOUND", message: "No active sequence found for this prospect." };
    }
    return { ok: true, data: sequence };
  } catch (error) {
    await errorTracker.trackError({
      service: "Database",
      category: "Database",
      severity: "HIGH",
      message: `[getActiveSequence] Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
      error
    });
    return { ok: false, error: "DB_ERROR", message: "Failed to load the active sequence." };
  }
}

/**
 * Get the latest sequence for a prospect regardless of status.
 */
export async function getLatestSequence(
  prospectId: string
): Promise<DbResult<SequenceWithSteps>> {
  try {
    const sequence = await prisma.sequence.findFirst({
      where: { prospect_id: prospectId },
      orderBy: { created_at: "desc" },
      include: { steps: { orderBy: { step_number: "asc" } } },
    });
    if (!sequence) {
      return { ok: false, error: "NOT_FOUND", message: "No sequence found for this prospect." };
    }
    return { ok: true, data: sequence };
  } catch (error) {
    await errorTracker.trackError({
      service: "Database",
      category: "Database",
      severity: "HIGH",
      message: `[getLatestSequence] Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
      error
    });
    return { ok: false, error: "DB_ERROR", message: "Failed to load the sequence." };
  }
}

/**
 * Get the full campaign history (all sequences) for a prospect.
 */
export async function getSequenceHistory(
  prospectId: string
): Promise<DbResult<SequenceWithSteps[]>> {
  try {
    const sequences = await prisma.sequence.findMany({
      where: { prospect_id: prospectId },
      orderBy: { created_at: "desc" },
      include: { steps: { orderBy: { step_number: "asc" } } },
    });
    return { ok: true, data: sequences };
  } catch (error) {
    await errorTracker.trackError({
      service: "Database",
      category: "Database",
      severity: "HIGH",
      message: `[getSequenceHistory] Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
      error
    });
    return { ok: false, error: "DB_ERROR", message: "Failed to load sequence history." };
  }
}

/**
 * Get a sequence by its own ID.
 */
export async function getSequence(
  sequenceId: string
): Promise<DbResult<SequenceWithSteps>> {
  try {
    const sequence = await prisma.sequence.findUnique({
      where: { id: sequenceId },
      include: { steps: { orderBy: { step_number: "asc" } } },
    });
    if (!sequence) {
      return { ok: false, error: "NOT_FOUND", message: "Sequence not found." };
    }
    return { ok: true, data: sequence };
  } catch (error) {
    await errorTracker.trackError({
      service: "Database",
      category: "Database",
      severity: "HIGH",
      message: `[getSequence] Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
      error
    });
    return { ok: false, error: "DB_ERROR", message: "Failed to load the sequence." };
  }
}
import { PaginationOptions, PaginatedResult } from "./pagination";

export type DbPaginatedResult<T> =
  | { ok: true; data: T[]; pagination: PaginatedResult<T>['pagination'] }
  | { ok: false; error: "DB_ERROR"; message: string };

/**
 * List all sequences with prospect and step details.
 * Ordered by creation date (newest first).
 */
export async function listSequences(options?: PaginationOptions): Promise<DbPaginatedResult<SequenceWithSteps & { prospect: { id: string; name: string; company: string; email: string; status: string } }>> {
  try {
    const page = options?.page ?? 1;
    const limit = options?.limit ?? 50;
    const skip = (page - 1) * limit;

    const [total, sequences] = await Promise.all([
      prisma.sequence.count(),
      prisma.sequence.findMany({
        skip,
        take: limit,
        orderBy: { created_at: "desc" },
        include: {
          prospect: {
            select: {
              id: true,
              name: true,
              company: true,
              email: true,
              status: true,
            },
          },
          steps: {
            orderBy: { step_number: "asc" },
          },
        },
      })
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      ok: true,
      data: sequences,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1
      }
    };
  } catch (error) {
    await errorTracker.trackError({
      service: "Database",
      category: "Database",
      severity: "HIGH",
      message: `[listSequences] Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
      error
    });
    return { ok: false, error: "DB_ERROR", message: "Failed to load sequences." };
  }
}

// ── Create ────────────────────────────────────────────────────────────────────

/**
 * Create a new DRAFT sequence for a prospect.
 * Returns DUPLICATE_SEQUENCE if one already exists.
 */
export async function createSequence(
  prospectId: string,
  steps: SanitizedStep[]
): Promise<DbResult<SequenceWithSteps>> {
  try {
    // Execute within a serializable transaction to prevent race conditions
    // when two parallel requests attempt to create a sequence for the same prospect.
    const sequence = await prisma.$transaction(async (tx) => {
      // 1. Lock the prospect row specifically to ensure atomicity for this prospect.
      const prospects = await tx.$queryRaw<{id: string, user_id: string}[]>`SELECT id, user_id FROM prospects WHERE id = ${prospectId} FOR UPDATE`;
      const fallbackUser = await tx.users.findFirst({ select: { id: true } });
      const prospectUserId = prospects[0]?.user_id || fallbackUser?.id || "";

      // 2. ACTIVE CAMPAIGN PROTECTION (Single source of truth)
      const activeSequence = await tx.sequence.findFirst({
        where: {
          prospect_id: prospectId,
          status: { in: ["ACTIVE", "DRAFT"] }
        }
      });

      if (activeSequence) {
        throw new Error("DUPLICATE_ACTIVE_SEQUENCE");
      }

      // 3. Insert the new sequence
      return tx.sequence.create({
        data: {
          prospect_id: prospectId,
          user_id: prospectUserId,
          status: "DRAFT",
          steps: {
            create: steps.map((step) => ({
              step_number: step.step_number,
              subject: step.subject,
              body: step.body,
              scheduled_at_utc: step.scheduled_at_utc,
              scheduled_time_local: step.scheduled_time_local,
              timezone: step.timezone,
              status: "PENDING",
            })),
          },
        },
        include: { steps: { orderBy: { step_number: "asc" } } },
      });
    });
    
    // Log Audit Event safely
    const user = await getSessionUser();
    const prospect = await prisma.prospect.findUnique({ where: { id: prospectId } });
    auditService.logAction(
      user?.id || 'system',
      user?.email || 'system',
      'SEQUENCE_CREATED',
      'CAMPAIGN',
      prospect ? `Sequence for ${prospect.email}` : `Sequence (${sequence.id})`,
      'Sequence',
      'SUCCESS',
      { resourceId: sequence.id, metadata: { prospectId, steps: steps.length } }
    );
    
    return { ok: true, data: sequence };
  } catch (error) {
    if (error instanceof Error && error.message === "DUPLICATE_ACTIVE_SEQUENCE") {
      return {
        ok: false,
        error: "DUPLICATE_SEQUENCE",
        message: "This prospect already has an ACTIVE or DRAFT sequence. Cannot create a new campaign until the current one finishes.",
      };
    }
    if (isDuplicateError(error)) {
      return {
        ok: false,
        error: "DUPLICATE_SEQUENCE",
        message: "This prospect already has a sequence. Edit the existing one.",
      };
    }
    await errorTracker.trackError({
      service: "Database",
      category: "Database",
      severity: "HIGH",
      message: `[createSequence] Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
      error
    });
    return { ok: false, error: "DB_ERROR", message: "Failed to create the sequence." };
  }
}

// ── Update ────────────────────────────────────────────────────────────────────

/**
 * Replace all steps in an existing DRAFT sequence.
 * Uses a transaction: delete existing steps, insert new ones, update sequence.
 * Returns INVALID_STATE if the sequence is not DRAFT.
 */
export async function updateSequence(
  sequenceId: string,
  steps: SanitizedStep[]
): Promise<DbResult<SequenceWithSteps>> {
  try {
    // First, check that the sequence is DRAFT — cannot edit ACTIVE/STOPPED/COMPLETED
    const existing = await prisma.sequence.findUnique({
      where: { id: sequenceId },
      select: { status: true },
    });

    if (!existing) {
      return { ok: false, error: "NOT_FOUND", message: "Sequence not found." };
    }

    if (existing.status !== "DRAFT") {
      return {
        ok: false,
        error: "INVALID_STATE",
        message: `Cannot edit a sequence with status "${existing.status}". Only DRAFT sequences can be edited.`,
      };
    }

    // Atomic: delete all existing steps, insert new ones
    const sequence = await prisma.$transaction(async (tx) => {
      await tx.sequenceStep.deleteMany({ where: { sequence_id: sequenceId } });

      return tx.sequence.update({
        where: { id: sequenceId },
        data: {
          steps: {
            create: steps.map((step) => ({
              step_number: step.step_number,
              subject: step.subject,
              body: step.body,
              scheduled_at_utc: step.scheduled_at_utc,
              scheduled_time_local: step.scheduled_time_local,
              timezone: step.timezone,
              status: "PENDING",
            })),
          },
        },
        include: { steps: { orderBy: { step_number: "asc" } } },
      });
    });

    const user = await getSessionUser();
    const prospect = await prisma.prospect.findUnique({ where: { id: sequence.prospect_id } });
    auditService.logAction(
      user?.id || 'system',
      user?.email || 'system',
      'SEQUENCE_UPDATED',
      'CAMPAIGN',
      prospect ? `Sequence for ${prospect.email}` : `Sequence (${sequence.id})`,
      'Sequence',
      'SUCCESS',
      { resourceId: sequence.id, metadata: { steps: steps.length } }
    );

    return { ok: true, data: sequence };
  } catch (error) {
    if (isNotFoundError(error)) {
      return { ok: false, error: "NOT_FOUND", message: "Sequence not found." };
    }
    await errorTracker.trackError({
      service: "Database",
      category: "Database",
      severity: "HIGH",
      message: `[updateSequence] Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
      error
    });
    return { ok: false, error: "DB_ERROR", message: "Failed to save the sequence." };
  }
}

// ── Start ─────────────────────────────────────────────────────────────────────

/**
 * Transition a DRAFT sequence to ACTIVE.
 *
 * Phase 3 contract: this action marks the sequence as active and sets
 * started_at. It does NOT trigger any Gmail sending. The scheduler
 * (Phase 4+) will pick up ACTIVE sequences.
 *
 * Returns INVALID_STATE if the sequence is not DRAFT.
 */
export async function startSequence(
  sequenceId: string
): Promise<DbResult<SequenceWithSteps>> {
  try {
    const existing = await prisma.sequence.findUnique({
      where: { id: sequenceId },
      select: { status: true },
    });

    if (!existing) {
      return { ok: false, error: "NOT_FOUND", message: "Sequence not found." };
    }

    if (existing.status !== "DRAFT") {
      return {
        ok: false,
        error: "INVALID_STATE",
        message: `Cannot start a sequence with status "${existing.status}". Only DRAFT sequences can be started.`,
      };
    }

    const sequence = await prisma.sequence.update({
      where: { id: sequenceId },
      data: {
        status: "ACTIVE",
        started_at: new Date(),
      },
      include: { steps: { orderBy: { step_number: "asc" } } },
    });

    const user = await getSessionUser();
    const prospect = await prisma.prospect.findUnique({ where: { id: sequence.prospect_id } });
    auditService.logAction(
      user?.id || 'system',
      user?.email || 'system',
      'SEQUENCE_STARTED',
      'CAMPAIGN',
      prospect ? `Sequence for ${prospect.email}` : `Sequence (${sequence.id})`,
      'Sequence',
      'SUCCESS',
      { resourceId: sequence.id }
    );

    return { ok: true, data: sequence };
  } catch (error) {
    if (isNotFoundError(error)) {
      return { ok: false, error: "NOT_FOUND", message: "Sequence not found." };
    }
    await errorTracker.trackError({
      service: "Database",
      category: "Database",
      severity: "HIGH",
      message: `[startSequence] Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
      error
    });
    return { ok: false, error: "DB_ERROR", message: "Failed to start the sequence." };
  }
}

// ── Delete ────────────────────────────────────────────────────────────────────

/**
 * Delete a DRAFT sequence and all its steps.
 * Returns INVALID_STATE if the sequence is not DRAFT.
 */
export async function deleteSequence(
  sequenceId: string
): Promise<DbResult<void>> {
  try {
    const existing = await prisma.sequence.findUnique({
      where: { id: sequenceId },
      select: { status: true },
    });

    if (!existing) {
      return { ok: false, error: "NOT_FOUND", message: "Sequence not found." };
    }

    // Allow deleting in any state so users can clear up the UI.
    // The cascade delete will safely remove steps.
    const sequenceToLog = await prisma.sequence.findUnique({ 
      where: { id: sequenceId },
      include: { prospect: true }
    });
    
    await prisma.$transaction([
      prisma.sequenceStep.deleteMany({ where: { sequence_id: sequenceId } }),
      prisma.sequence.delete({ where: { id: sequenceId } }),
    ]);
    
    const user = await getSessionUser();
    auditService.logAction(
      user?.id || 'system',
      user?.email || 'system',
      'SEQUENCE_DELETED',
      'CAMPAIGN',
      sequenceToLog?.prospect ? `Sequence for ${sequenceToLog.prospect.email}` : `Sequence (${sequenceId})`,
      'Sequence',
      'SUCCESS',
      { resourceId: sequenceId }
    );
    
    return { ok: true, data: undefined };
  } catch (error) {
    if (isNotFoundError(error)) {
      return { ok: false, error: "NOT_FOUND", message: "Sequence not found." };
    }
    await errorTracker.trackError({
      service: "Database",
      category: "Database",
      severity: "HIGH",
      message: `[deleteSequence] Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
      error
    });
    return { ok: false, error: "DB_ERROR", message: "Failed to delete the sequence." };
  }
}
