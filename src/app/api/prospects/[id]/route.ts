/**
 * API Route — /api/prospects/[id]
 *
 * GET    /api/prospects/:id  → get a single prospect (tenant-scoped)
 * PUT    /api/prospects/:id  → update a prospect (tenant-scoped)
 * DELETE /api/prospects/:id  → delete a prospect (tenant-scoped)
 *
 * All operations verify ownership via user_id — prevents IDOR attacks.
 * Server-side only. No raw DB errors or stack traces reach the client.
 */

import { NextRequest, NextResponse } from "next/server";
import { validateProspectUpdate } from "@/lib/validations/prospect";
import prisma from "@/lib/prisma";
import { auditService } from "@/lib/audit/audit.service";
import { getNetworkContext } from "@/lib/audit/network";
import { getSession } from "@/lib/auth/session";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // user_id in WHERE prevents reading another tenant's prospect by ID (IDOR fix)
  const prospect = await prisma.prospect.findUnique({
    where: { id, user_id: session.user.id },
  });

  if (!prospect) {
    return NextResponse.json({ error: "Prospect not found." }, { status: 404 });
  }

  return NextResponse.json({ data: prospect });
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON in request body." }, { status: 400 });
  }

  const validation = validateProspectUpdate(body);
  if (!validation.valid) {
    return NextResponse.json(
      { error: "Validation failed.", errors: validation.errors },
      { status: 422 }
    );
  }

  try {
    // user_id in WHERE clause prevents IDOR write attacks
    const prospect = await prisma.prospect.update({
      where: { id, user_id: session.user.id },
      data: validation.sanitized!,
    });

    return NextResponse.json({ data: prospect });
  } catch (err: any) {
    if (err?.code === "P2025") {
      return NextResponse.json({ error: "Prospect not found." }, { status: 404 });
    }
    if (err?.code === "P2002") {
      return NextResponse.json(
        { error: "A prospect with that email already exists.", errors: [{ field: "email", message: "Email already in use." }] },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Failed to update prospect." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Fetch for audit log — scoped to prevent IDOR read before delete
  const prospectToLog = await prisma.prospect.findUnique({
    where: { id, user_id: session.user.id },
    select: { email: true },
  });

  if (!prospectToLog) {
    return NextResponse.json({ error: "Prospect not found." }, { status: 404 });
  }

  try {
    // user_id in WHERE prevents IDOR delete attacks
    await prisma.prospect.delete({
      where: { id, user_id: session.user.id },
    });
  } catch (err: any) {
    if (err?.code === "P2025") {
      return NextResponse.json({ error: "Prospect not found." }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to delete prospect." }, { status: 500 });
  }

  const network = getNetworkContext(_req);
  auditService.logAction(
    session.user.id,
    session.user.email,
    "Prospect Deleted",
    "PROSPECT",
    prospectToLog.email,
    "Prospect",
    "SUCCESS",
    {
      resourceId: id,
      ipAddress: network.ipAddress,
      deviceInfo: network.deviceInfo,
      metadata: { country: network.country, browser: network.browser, os: network.os },
    }
  );

  return new NextResponse(null, { status: 204 });
}
