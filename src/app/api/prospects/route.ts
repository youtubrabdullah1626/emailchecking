/**
 * API Route — /api/prospects
 *
 * GET  /api/prospects        → list all prospects (newest first)
 * POST /api/prospects        → create a new prospect
 *
 * Server-side only. Prisma is never called from the client.
 * Input is always validated before any DB operation.
 * Errors are always returned as user-friendly messages — no stack traces.
 */

import { NextRequest, NextResponse } from "next/server";
import { listProspects, createProspect } from "@/lib/db/prospects";
import { validateProspectCreate } from "@/lib/validations/prospect";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "50", 10);

  const result = await listProspects({ page, limit });

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 500 });
  }

  // Next.js Response format expected by the frontend
  return NextResponse.json({ 
    data: result.data, 
    pagination: result.pagination 
  });
}

export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON in request body." },
      { status: 400 }
    );
  }

  // Server-side validation — authoritative
  const validation = validateProspectCreate(body);
  if (!validation.valid) {
    return NextResponse.json(
      { error: "Validation failed.", errors: validation.errors },
      { status: 422 }
    );
  }

  const result = await createProspect(validation.sanitized!);

  if (!result.ok) {
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

  return NextResponse.json({ data: result.data }, { status: 201 });
}
