/**
 * API Route — /api/sequences/[id]
 *
 * PUT    → replace all steps in a DRAFT sequence
 * DELETE → delete a DRAFT sequence
 */

import { NextRequest, NextResponse } from "next/server";
import { updateSequence, deleteSequence } from "@/lib/db/sequences";
import { validateSequenceInput } from "@/lib/validations/sequence";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: RouteContext) {
  const { id: sequenceId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON in request body." }, { status: 400 });
  }

  const validation = validateSequenceInput(body);
  if (!validation.valid) {
    return NextResponse.json(
      { error: "Validation failed.", errors: validation.errors },
      { status: 422 }
    );
  }

  const result = await updateSequence(sequenceId, validation.sanitizedSteps!);
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

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const { id: sequenceId } = await params;

  const result = await deleteSequence(sequenceId);
  if (!result.ok) {
    if (result.error === "NOT_FOUND") {
      return NextResponse.json({ error: result.message }, { status: 404 });
    }
    if (result.error === "INVALID_STATE") {
      return NextResponse.json({ error: result.message }, { status: 409 });
    }
    return NextResponse.json({ error: result.message }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}
