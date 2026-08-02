/**
 * API Route — /api/prospects/[id]/sequence
 *
 * GET  → return the prospect's sequence (with steps)
 * POST → create a new DRAFT sequence for the prospect
 */

import { NextRequest, NextResponse } from "next/server";
import { getProspect } from "@/lib/db/prospects";
import { getProspectSequence, createSequence } from "@/lib/db/sequences";
import { validateSequenceInput } from "@/lib/validations/sequence";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { id: prospectId } = await params;

  // Verify prospect exists
  const prospectResult = await getProspect(prospectId);
  if (!prospectResult.ok) {
    const status = prospectResult.error === "NOT_FOUND" ? 404 : 500;
    return NextResponse.json({ error: prospectResult.message }, { status });
  }

  const result = await getProspectSequence(prospectId);
  if (!result.ok) {
    if (result.error === "NOT_FOUND") {
      return NextResponse.json({ data: null }, { status: 200 });
    }
    return NextResponse.json({ error: result.message }, { status: 500 });
  }

  return NextResponse.json({ data: result.data });
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { id: prospectId } = await params;

  // Verify prospect exists
  const prospectResult = await getProspect(prospectId);
  if (!prospectResult.ok) {
    const status = prospectResult.error === "NOT_FOUND" ? 404 : 500;
    return NextResponse.json({ error: prospectResult.message }, { status });
  }

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

  const result = await createSequence(prospectId, validation.sanitizedSteps!);
  if (!result.ok) {
    if (result.error === "DUPLICATE_SEQUENCE") {
      return NextResponse.json({ error: result.message }, { status: 409 });
    }
    return NextResponse.json({ error: result.message }, { status: 500 });
  }

  return NextResponse.json({ data: result.data }, { status: 201 });
}
