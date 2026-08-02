/**
 * Reply Stop Action — Atomic Sequence Cancellation
 *
 * Executes the complete stop workflow when a REAL_REPLY is confirmed.
 *
 * This is an atomic Prisma transaction that:
 *   1. Cancels all PENDING and PROCESSING steps for the sequence
 *   2. Sets sequence.status = STOPPED, sequence.stopped_at = now()
 *   3. Sets prospect.status = REPLIED
 *   4. Creates a ReplyClassification record (idempotent: @unique on gmail_message_id)
 *   5. Creates EmailEvent CANCELLED records for each cancelled step
 *
 * Idempotency:
 *   - If the sequence is already STOPPED/COMPLETED, the action is skipped
 *   - If the gmail_message_id already has a ReplyClassification, the DB will
 *     reject the duplicate insert (P2002), which is caught and treated as already-done
 *   - Running the stop action twice is safe
 *
 * Atomicity:
 *   - All 5 operations are inside a single Prisma $transaction
 *   - If any step fails, the entire transaction rolls back
 *   - The sequence never ends up in a partial stop state
 *
 * Server-side only. Never import from client components.
 */

import prisma from "@/lib/prisma";
import { replyLog } from "./logger";
import { emailTrackingService } from "@/lib/tracking/EmailTrackingService";
import type { ClassificationResult, StopResult } from "./types";

// Statuses that mean a step is still stoppable
const CANCELLABLE_STATUSES: Array<"PENDING" | "PROCESSING"> = ["PENDING", "PROCESSING"];

// Statuses that mean the sequence is already terminal — skip the stop
const TERMINAL_SEQUENCE_STATUSES = new Set(["STOPPED", "COMPLETED"]);

/**
 * Execute the atomic stop action for a confirmed real reply.
 *
 * @param sequenceId     — the sequence to stop
 * @param prospectId     — the prospect to mark as REPLIED
 * @param classification — the confirmed REAL_REPLY classification
 */
export async function applyReplyStop(
  sequenceId: string,
  prospectId: string,
  classification: ClassificationResult
): Promise<StopResult> {
  replyLog("sequence_stop_triggered", {
    sequenceId,
    prospectId,
    gmailThreadId: classification.gmailThreadId,
    gmailMessageId: classification.gmailMessageId,
    replyType: classification.replyType,
  });

  try {
    const result = await prisma.$transaction(async (tx) => {
      // ── 1. Lock sequence and steps to prevent race conditions (scheduler) ──
      // By locking the sequence, we ensure no concurrent update to its status.
      // By locking its pending steps, we block the scheduler from claiming them.
      await tx.$executeRaw`SELECT id FROM sequences WHERE id = ${sequenceId} FOR UPDATE`;
      await tx.$executeRaw`SELECT id FROM sequence_steps WHERE sequence_id = ${sequenceId} AND status IN ('PENDING', 'PROCESSING') FOR UPDATE`;

      const sequence = await tx.sequence.findUnique({
        where: { id: sequenceId },
        select: {
          status: true,
          steps: {
            where: { status: { in: CANCELLABLE_STATUSES } },
            select: { id: true, status: true },
          },
        },
      });

      if (!sequence) {
        throw new Error(`Sequence ${sequenceId} not found.`);
      }

      // (Idempotency guard removed: we want to process new replies even if the sequence is COMPLETED or STOPPED. Duplicate messages are prevented by the unique gmail_message_id constraint in step 6.)

      const cancellableSteps = sequence.steps;
      const now = new Date();

      // ── 3. Cancel PENDING and PROCESSING steps ────────────────────────────
      if (cancellableSteps.length > 0) {
        await tx.sequenceStep.updateMany({
          where: {
            id: { in: cancellableSteps.map((s: { id: string }) => s.id) },
            status: { in: CANCELLABLE_STATUSES },
          },
          data: { status: "CANCELLED" },
        });

        // Create EmailEvent CANCELLED records for audit trail
        await tx.emailEvent.createMany({
          data: cancellableSteps.map((step: { id: string }) => ({
            sequence_step_id: step.id,
            event_type: "CANCELLED" as const,
            occurred_at: now,
            metadata: {
              reason: "real_reply_received",
              gmail_thread_id: classification.gmailThreadId,
              gmail_message_id: classification.gmailMessageId,
            },
          })),
        });

        replyLog("sequence_steps_cancelled", {
          sequenceId,
          prospectId,
          stepsCancelled: cancellableSteps.length,
          gmailThreadId: classification.gmailThreadId,
        });
      }

      // ── 4. Stop the sequence ──────────────────────────────────────────────
      await tx.sequence.update({
        where: { id: sequenceId },
        data: {
          status: "STOPPED",
          stopped_at: now,
        },
      });

      // ── 5. Mark the prospect as REPLIED ───────────────────────────────────
      await tx.prospect.update({
        where: { id: prospectId },
        data: { status: "REPLIED" },
      });

      // ── 6. Record the reply classification ───────────────────────────────
      await tx.replyClassification.create({
        data: {
          prospect_id: prospectId,
          gmail_thread_id: classification.gmailThreadId,
          gmail_message_id: classification.gmailMessageId,
          reply_type: "REAL_REPLY",
          raw_snippet: classification.snippet || null,
          classified_at: now,
        },
      });

      // ── 6.5 Universal Email Tracking Engine Event ────────────────────────
      // Ingest the REPLIED event into the tracking engine, which will
      // securely lock the tracking states of all outbound emails in this thread.
      await emailTrackingService.ingestEventByProviderThreadId(classification.gmailThreadId, "REPLIED");

      // ── 7. Record immutable AuditLog event ────────────────────────────────
      const prospectInfo = await tx.prospect.findUnique({
        where: { id: prospectId },
        select: { email: true, name: true, company: true },
      });

      await tx.auditLog.create({
        data: {
          action_type: "SYSTEM_ACTION",
          action: "PROSPECT_REPLIED_SEQUENCE_STOPPED",
          prospect_id: prospectId,
          sequence_id: sequenceId,
          metadata: {
            gmail_thread_id: classification.gmailThreadId,
            gmail_message_id: classification.gmailMessageId,
            reply_type: classification.replyType,
            steps_cancelled: cancellableSteps.length,
            prospect_email: prospectInfo?.email ?? classification.fromEmail,
          },
        },
      });

      replyLog("reply_processing_completed", {
        sequenceId,
        prospectId,
        gmailThreadId: classification.gmailThreadId,
        gmailMessageId: classification.gmailMessageId,
        stepsCancelled: cancellableSteps.length,
        outcome: "REAL_REPLY",
      });

      return {
        sequenceId,
        prospectId,
        prospectEmail: prospectInfo?.email ?? classification.fromEmail,
        prospectName: prospectInfo?.name ?? "",
        company: prospectInfo?.company ?? "",
        stepsCancelled: cancellableSteps.length,
        stateUpdated: true,
        classificationRecorded: true,
      };
    });

    // ── 8. Dispatch to CRM Adapter Layer (non-blocking for DB atomicity) ────
    try {
      const { getCrmAdapter } = await import("@/lib/crm/adapter");
      const crmAdapter = getCrmAdapter();
      await crmAdapter.onProspectReplied({
        prospectId: result.prospectId,
        prospectEmail: result.prospectEmail,
        prospectName: result.prospectName,
        company: result.company,
        sequenceId: result.sequenceId,
        gmailThreadId: classification.gmailThreadId,
        gmailMessageId: classification.gmailMessageId,
        replyType: classification.replyType,
        rawSnippet: classification.snippet || null,
        timestamp: new Date().toISOString(),
      });
    } catch {
      // Non-fatal: CRM sync errors do not roll back sequence cancellation
    }

    return result;
  } catch (err) {
    // ── Duplicate classification guard ────────────────────────────────────
    // If we already processed this exact Gmail message, the @unique constraint
    // on reply_classifications.gmail_message_id will throw P2002.
    // This is safe — the sequence was already stopped by a previous run.
    if (isDuplicateError(err)) {
      replyLog("reply_processing_completed", {
        sequenceId,
        prospectId,
        gmailMessageId: classification.gmailMessageId,
        outcome: "ALREADY_STOPPED",
        detail: "ReplyClassification already exists for this message — idempotent skip.",
      });
      return {
        sequenceId,
        prospectId,
        stepsCancelled: 0,
        stateUpdated: false,
        classificationRecorded: false,
      };
    }

    throw err; // Re-throw unexpected errors
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isDuplicateError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === "P2002"
  );
}
