/**
 * API Route — /api/sequences
 *
 * GET /api/sequences → list all sequences with prospect and steps
 */

import { NextRequest, NextResponse } from "next/server";
import { listSequences } from "@/lib/db/sequences";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "50", 10);

  const result = await listSequences(userId, { page, limit });

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 500 });
  }

  return NextResponse.json({
    data: result.data,
    pagination: result.pagination
  });
}
