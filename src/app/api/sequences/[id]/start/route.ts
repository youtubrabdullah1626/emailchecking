/**
 * API Route — POST /api/sequences/[id]/start
 *
 * Transition a DRAFT sequence to ACTIVE.
 *
 * Phase 3 safety contract:
 *   - Re-validates all steps server-side before starting
 *   - Sets status → ACTIVE and started_at → now()
 *   - Does NOT trigger any Gmail sending
 *   - Does NOT schedule any background jobs
 *   - The scheduler (Phase 4+) will pick up ACTIVE sequences
 */

import { NextRequest, NextResponse } from "next/server";
import { getSequence, startSequence } from "@/lib/db/sequences";
import { validateSequenceInput } from "@/lib/validations/sequence";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: RouteContext) {
  const { id: sequenceId } = await params;

  // Fetch the current sequence to re-validate its steps
  const fetchResult = await getSequence(sequenceId);
  if (!fetchResult.ok) {
    const status = fetchResult.error === "NOT_FOUND" ? 404 : 500;
    return NextResponse.json({ error: fetchResult.message }, { status });
  }

  const sequence = fetchResult.data;

  // Re-validate: must be DRAFT
  if (sequence.status !== "DRAFT") {
    return NextResponse.json(
      { error: `Cannot start a sequence with status "${sequence.status}". Only DRAFT sequences can be started.` },
      { status: 409 }
    );
  }

  // Re-validate: must have at least one step
  if (sequence.steps.length === 0) {
    return NextResponse.json(
      { error: "Cannot start an empty sequence. Add at least one email step first." },
      { status: 422 }
    );
  }

  // Re-validate step integrity server-side — reconstruct from stored DB values
  // Since steps are already stored with computed UTC, verify they still look valid
  for (const step of sequence.steps) {
    if (!step.subject.trim()) {
      return NextResponse.json(
        { error: `Step ${step.step_number} has an empty subject. Edit the sequence before starting.` },
        { status: 422 }
      );
    }
    if (!step.body.trim()) {
      return NextResponse.json(
        { error: `Step ${step.step_number} has an empty body. Edit the sequence before starting.` },
        { status: 422 }
      );
    }
  }

  // All checks pass — transition to ACTIVE
  const result = await startSequence(sequenceId);
  if (!result.ok) {
    if (result.error === "NOT_FOUND") {
      return NextResponse.json({ error: result.message }, { status: 404 });
    }
    if (result.error === "INVALID_STATE") {
      return NextResponse.json({ error: result.message }, { status: 409 });
    }
    return NextResponse.json({ error: result.message }, { status: 500 });
  }

  return NextResponse.json({ data: result.data });
}
