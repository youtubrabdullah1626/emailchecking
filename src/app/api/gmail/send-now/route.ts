/**
 * POST /api/gmail/send-now
 *
 * Send Immediately — bypasses the scheduler's scheduled_at_utc gate.
 *
 * This endpoint allows a single PENDING sequence step to be sent right now,
 * regardless of when it was originally scheduled. It follows the exact same
 * state-machine contract as the scheduler-driven send:
 *
 *   PENDING → PROCESSING → SENT (success)
 *   PENDING → PROCESSING → FAILED (Gmail API error)
 *
 * Safety guarantees:
 *   1. The step MUST be in PENDING status (duplicates blocked by atomic claim).
 *   2. If gmail_message_id is already set, the request is rejected immediately.
 *   3. All state transitions go through the same sender.ts pipeline.
 *   4. An EmailEvent audit record is created atomically with the status update.
 *
 * Request body:
 *   { "stepId": "<cuid>" }
 *
 * Response (success):
 *   { ok: true, stepId, gmailMessageId, gmailThreadId, detail }
 *
 * Response (failure):
 *   { ok: false, error, detail? }
 */

import { NextRequest, NextResponse } from "next/server";
import { sendStep } from "@/lib/gmail/sender";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  // ── Auth Guard ───────────────────────────────────────────────
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  // ── 1. Parse and validate request body ──────────────────────────────────
  let body: { stepId: string };
  try {
    const raw = await request.json();
    if (!raw || typeof raw !== "object" || typeof raw.stepId !== "string" || !raw.stepId.trim()) {
      return NextResponse.json(
        { ok: false, error: "INVALID_REQUEST", detail: "stepId is required and must be a non-empty string" },
        { status: 400 }
      );
    }
    body = { stepId: raw.stepId.trim() };
  } catch {
    return NextResponse.json(
      { ok: false, error: "INVALID_REQUEST", detail: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { stepId } = body;

  // ── 2. Verify the step exists and check pre-conditions ──────────────────
  let step: {
    id: string;
    status: string;
    gmail_message_id: string | null;
    sequence: { status: string; prospect: { email: string; status: string } };
  } | null;

  try {
    // Ownership check: include sequence.user_id in select, verify below
    step = await prisma.sequenceStep.findUnique({
      where: { id: stepId },
      select: {
        id: true,
        status: true,
        gmail_message_id: true,
        sequence: {
          select: {
            status: true,
            user_id: true,
            prospect: {
              select: { email: true, status: true },
            },
          },
        },
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Database error";
    return NextResponse.json(
      { ok: false, error: "DATABASE_ERROR", detail: message },
      { status: 500 }
    );
  }

  if (!step) {
    return NextResponse.json(
      { ok: false, error: "NOT_FOUND", detail: `Step ${stepId} not found.` },
      { status: 404 }
    );
  }

  // ── Ownership verification: reject cross-tenant step access ──────────────
  if ((step.sequence as any).user_id !== session.user.id) {
    return NextResponse.json(
      { ok: false, error: "NOT_FOUND", detail: `Step ${stepId} not found.` },
      { status: 404 }
    );
  }

  // Duplicate guard: already sent
  if (step.status === "SENT" || step.gmail_message_id) {
    return NextResponse.json(
      {
        ok: false,
        error: "ALREADY_SENT",
        detail: "This email has already been sent.",
        gmailMessageId: step.gmail_message_id,
      },
      { status: 409 }
    );
  }

  // Block if not in a sendable state
  if (step.status !== "PENDING") {
    return NextResponse.json(
      {
        ok: false,
        error: "INVALID_STATUS",
        detail: `Step is in status '${step.status}' and cannot be sent. Only PENDING steps can be sent immediately.`,
      },
      { status: 409 }
    );
  }

  // Block if sequence is not active
  if (step.sequence.status !== "ACTIVE") {
    return NextResponse.json(
      {
        ok: false,
        error: "SEQUENCE_NOT_ACTIVE",
        detail: `The sequence is '${step.sequence.status}'. Start the sequence before sending.`,
      },
      { status: 409 }
    );
  }

  // ── 3. Atomically claim the step (PENDING → PROCESSING) ─────────────────
  // This uses the same updateMany WHERE status='PENDING' pattern as the scheduler.
  // If another process claimed it concurrently, count will be 0.
  let claimed: { count: number };
  try {
    claimed = await prisma.sequenceStep.updateMany({
      where: { id: stepId, status: "PENDING" },
      data: { status: "PROCESSING" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Database error";
    return NextResponse.json(
      { ok: false, error: "CLAIM_FAILED", detail: message },
      { status: 500 }
    );
  }

  if (claimed.count === 0) {
    // Concurrent send won the race — fetch current status to report
    const current = await prisma.sequenceStep
      .findUnique({ where: { id: stepId }, select: { status: true } })
      .catch(() => null);
    return NextResponse.json(
      {
        ok: false,
        error: "ALREADY_CLAIMED",
        detail: `Step was already claimed by another process (current status: ${current?.status ?? "unknown"}).`,
      },
      { status: 409 }
    );
  }

  // ── 4. Call the Gmail sender pipeline ────────────────────────────────────
  // sendStep handles: loading step data, building message, Gmail API call,
  // atomic DB update (PROCESSING→SENT or PROCESSING→FAILED), EmailEvent creation.
  const result = await sendStep(stepId);

  // ── 5. Return structured response ────────────────────────────────────────
  if (result.outcome === "SENT") {
    return NextResponse.json({
      ok: true,
      stepId: result.stepId,
      gmailMessageId: result.gmailMessageId,
      gmailThreadId: result.gmailThreadId,
      detail: result.detail,
    });
  }

  // FAILED or ABORTED
  return NextResponse.json(
    {
      ok: false,
      error: result.outcome,
      stepId: result.stepId,
      detail: result.detail,
    },
    { status: 500 }
  );
}
