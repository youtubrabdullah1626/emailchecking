/**
 * Gmail Sender Query — Database Layer
 *
 * Loads the complete data needed to send one sequence step.
 * This is SEPARATE from the scheduler query (src/lib/scheduler/query.ts).
 *
 * Key differences from the scheduler query:
 *   - Includes `body` (required for email content; excluded from scheduler for log safety)
 *   - Includes `gmail_message_id` and `gmail_thread_id` (for idempotency guard and thread continuation)
 *   - Includes all sibling steps in the sequence (to find the previous step for thread continuation)
 *   - Returns null if step not found
 *
 * Server-side only. Do not import from client components.
 */

import prisma from "@/lib/prisma";
import type { StepForSend } from "./types";

/**
 * Load a single sequence step with all data required to send it.
 *
 * Returns null if the step does not exist.
 * The caller MUST check step.status === 'PROCESSING' before sending.
 */
export async function loadStepForSend(
  stepId: string
): Promise<StepForSend | null> {
  const row = await prisma.sequenceStep.findUnique({
    where: { id: stepId },
    select: {
      id: true,
      step_number: true,
      subject: true,
      body: true,
      status: true,
      gmail_message_id: true,
      gmail_thread_id: true,
      sequence: {
        select: {
          id: true,
          status: true,
          user_id: true,
          assigned_sender_email: true,
          prospect: {
            select: {
              id: true,
              name: true,
              email: true,
              status: true,
              campaign: {
                select: {
                  id: true,
                  status: true,
                }
              }
            },
          },
          // Load all steps so we can find the immediate predecessor
          // for In-Reply-To thread continuation (Step 2, 3, 4)
          steps: {
            orderBy: { step_number: "asc" },
            select: {
              step_number: true,
              gmail_message_id: true,
              gmail_thread_id: true,
            },
          },
        },
      },
    },
  });

  if (!row) return null;

  // Find the immediately preceding step (for thread continuation)
  const previousStep =
    row.sequence.steps
      .filter((s) => s.step_number < row.step_number)
      .sort((a, b) => b.step_number - a.step_number)[0] ?? null;

  return {
    id: row.id,
    step_number: row.step_number,
    subject: row.subject,
    body: row.body,
    status: row.status,
    gmail_message_id: row.gmail_message_id,
    gmail_thread_id: row.gmail_thread_id,
    sequence: {
      id: row.sequence.id,
      status: row.sequence.status,
      user_id: row.sequence.user_id,
      prospect: row.sequence.prospect,
    },
    previousStep: previousStep
      ? {
          gmail_message_id: previousStep.gmail_message_id,
          gmail_thread_id: previousStep.gmail_thread_id,
        }
      : null,
  };
}
