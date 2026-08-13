/**
 * API Route — /api/prospects
 *
 * GET  /api/prospects        → list all prospects for the authenticated user
 * POST /api/prospects        → create a new prospect owned by the authenticated user
 *
 * Server-side only. Prisma is never called from the client.
 * Input is always validated before any DB operation.
 * Errors are always returned as user-friendly messages — no stack traces.
 */

import { NextRequest, NextResponse } from "next/server";
import { createProspect } from "@/lib/db/prospects";
import { validateProspectCreate } from "@/lib/validations/prospect";
import prisma from "@/lib/prisma";
import { auditService } from "@/lib/audit/audit.service";
import { getNetworkContext } from "@/lib/audit/network";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "50", 10);
  const skip = (page - 1) * limit;

  try {
    // Query directly with user_id — bypasses DAL which lacks tenant param
    const [total, prospects] = await prisma.$transaction([
      prisma.prospect.count({ where: { user_id: session.user.id } }),
      prisma.prospect.findMany({
        where: { user_id: session.user.id },
        skip,
        take: limit,
        orderBy: { created_at: "desc" },
        include: {
          campaign: { select: { id: true, name: true } },
          sequences: {
            orderBy: { created_at: "desc" },
            take: 1,
            select: {
              id: true,
              status: true,
              steps: { select: { id: true, step_number: true, status: true } },
            },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);
    return NextResponse.json({
      data: prospects,
      pagination: {
        page, limit, total, totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      },
    });
  } catch (error: any) {
    console.error("Failed to fetch prospects", error);
    return NextResponse.json({ error: "Failed to load prospects." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON in request body." }, { status: 400 });
  }

  const validation = validateProspectCreate(body);
  if (!validation.valid) {
    return NextResponse.json(
      { error: "Validation failed.", errors: validation.errors },
      { status: 422 }
    );
  }

  // FIXED: user_id comes from the verified session, not from findFirst()
  const result = await createProspect({
    ...validation.sanitized!,
    user_id: session.user.id,
  });

  if (!result.ok) {
    if (result.error === "DUPLICATE_EMAIL") {
      return NextResponse.json(
        { error: result.message, errors: [{ field: "email", message: result.message }] },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: result.message }, { status: 500 });
  }

  const network = getNetworkContext(request);
  auditService.logAction(
    session.user.id,
    session.user.email,
    "Prospect Created",
    "PROSPECT",
    result.data.email,
    "Prospect",
    "SUCCESS",
    {
      resourceId: result.data.id,
      ipAddress: network.ipAddress,
      deviceInfo: network.deviceInfo,
      metadata: {
        source: "MANUAL",
        company: result.data.company,
        country: network.country,
        browser: network.browser,
        os: network.os,
      },
    }
  );

  return NextResponse.json({ data: result.data }, { status: 201 });
}
