/**
 * API Route — /api/prospects/[id]
 *
 * GET    /api/prospects/:id  → get a single prospect
 * PUT    /api/prospects/:id  → update a prospect
 * DELETE /api/prospects/:id  → delete a prospect
 *
 * Server-side only. No raw DB errors or stack traces reach the client.
 */

import { NextRequest, NextResponse } from "next/server";
import { getProspect, updateProspect, deleteProspect } from "@/lib/db/prospects";
import { validateProspectUpdate } from "@/lib/validations/prospect";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  const result = await getProspect(id);

  if (!result.ok) {
    const status = result.error === "NOT_FOUND" ? 404 : 500;
    return NextResponse.json({ error: result.message }, { status });
  }

  return NextResponse.json({ data: result.data });
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON in request body." },
      { status: 400 }
    );
  }

  const validation = validateProspectUpdate(body);
  if (!validation.valid) {
    return NextResponse.json(
      { error: "Validation failed.", errors: validation.errors },
      { status: 422 }
    );
  }

  const result = await updateProspect(id, validation.sanitized!);

  if (!result.ok) {
    if (result.error === "NOT_FOUND") {
      return NextResponse.json({ error: result.message }, { status: 404 });
    }
    if (result.error === "DUPLICATE_EMAIL") {
      return NextResponse.json(
        {
          error: result.message,
          errors: [{ field: "email", message: result.message }],
        },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: result.message }, { status: 500 });
  }

  return NextResponse.json({ data: result.data });
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  const result = await deleteProspect(id);

  if (!result.ok) {
    const status = result.error === "NOT_FOUND" ? 404 : 500;
    return NextResponse.json({ error: result.message }, { status });
  }

  return new NextResponse(null, { status: 204 });
}
