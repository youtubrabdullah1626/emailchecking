/**
 * Gmail Reply Tracker — Database Repository
 *
 * All database interactions for the push-notification reply tracking system.
 * Single responsibility: read and write the database. Never calls Gmail APIs.
 * Never contains classification or sequence business logic.
 *
 * Consumers:
 *   - engine.ts calls every function here during notification processing.
 *   - watch route (api/gmail/watch) calls saveWatchState / getWatchState.
 *
 * Design:
 *   - All writes use upsert where possible for idempotency.
 *   - isAlreadyClassified() is the primary idempotency guard — checked before
 *     any Gmail API call to avoid unnecessary quota usage.
 *   - getSequenceByThreadId() uses an indexed column (gmail_thread_id on
 *     sequence_steps) — not a full table scan.
 *
 * Server-side only. Never import from client components.
 */

import prisma from "@/lib/prisma";
import type { WatchRegistration } from "./types";

// ── Watch state ───────────────────────────────────────────────────────────────

/**
 * Retrieve the current Gmail Watch registration state for an email address.
 * Returns null if no watch has ever been registered.
 */
export async function getWatchState(email: string): Promise<{
  historyId: string;
  expiration: bigint;
  topicName: string;
  registeredAt: Date;
} | null> {
  const row = await prisma.gmailWatchState.findUnique({
    where: { email },
    select: {
      history_id: true,
      expiration: true,
      topic_name: true,
      registered_at: true,
    },
  });

  if (!row) return null;

  return {
    historyId: row.history_id,
    expiration: row.expiration,
    topicName: row.topic_name,
    registeredAt: row.registered_at,
  };
}

/**
 * Persist a Gmail Watch registration.
 * Upsert: creates the row on first registration, updates on renewal.
 *
 * @param registration - Data returned by registerGmailWatch() in gmail.ts
 */
export async function saveWatchState(
  registration: WatchRegistration
): Promise<void> {
  await prisma.gmailWatchState.upsert({
    where: { email: registration.emailAddress },
    create: {
      email: registration.emailAddress,
      history_id: registration.historyId,
      expiration: registration.expiration,
      topic_name: registration.topicName,
    },
    update: {
      history_id: registration.historyId,
      expiration: registration.expiration,
      topic_name: registration.topicName,
    },
  });
}

/**
 * Advance the stored history cursor to a new historyId.
 *
 * Called at the end of every successful notification processing cycle.
 * This is the most frequently called write in the system — it must be fast.
 *
 * No-op if the email has no watch state row (defensive guard).
 */
export async function advanceHistoryCursor(
  email: string,
  newHistoryId: string
): Promise<void> {
  await prisma.gmailWatchState.updateMany({
    where: { email },
    data: {
      history_id: newHistoryId,
      last_synced_at: new Date(),
      health_status: "HEALTHY",
      error_count: 0,
      last_error: null,
    },
  });
}

// ── Sequence matching ─────────────────────────────────────────────────────────

/**
 * Find the active sequence that owns a given Gmail thread ID.
 *
 * Looks up sequence_steps where gmail_thread_id matches, then returns the
 * parent sequence with prospect details. Only ACTIVE and COMPLETED sequences
 * are included — STOPPED and DRAFT sequences are excluded.
 *
 * Returns null if no sequence is tracking this thread (most common case for
 * threads that are not part of our outreach campaigns).
 *
 * Note: gmail_thread_id is on sequence_steps, not sequences. We join up via
 * the Prisma relation. The query resolves to a single DB round-trip.
 */
export async function getSequenceByThreadId(gmailThreadId: string): Promise<{
  sequenceId: string;
  prospectId: string;
  prospectName: string;
  prospectEmail: string;
} | null> {
  const step = await prisma.sequenceStep.findFirst({
    where: {
      gmail_thread_id: gmailThreadId,
      sequence: {
        status: { in: ["ACTIVE", "COMPLETED"] },
      },
    },
    select: {
      sequence: {
        select: {
          id: true,
          prospect: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
    },
  });

  if (!step) return null;

  return {
    sequenceId: step.sequence.id,
    prospectId: step.sequence.prospect.id,
    prospectName: step.sequence.prospect.name,
    prospectEmail: step.sequence.prospect.email,
  };
}

// ── Idempotency ───────────────────────────────────────────────────────────────

/**
 * Check whether a Gmail message has already been classified.
 *
 * This is the primary idempotency guard — called before any Gmail API fetch
 * to avoid unnecessary quota usage on duplicate PubSub notifications.
 *
 * Relies on the @unique constraint on reply_classifications.gmail_message_id.
 */
export async function isAlreadyClassified(
  gmailMessageId: string
): Promise<boolean> {
  const existing = await prisma.replyClassification.findUnique({
    where: { gmail_message_id: gmailMessageId },
    select: { id: true },
  });
  return existing !== null;
}
