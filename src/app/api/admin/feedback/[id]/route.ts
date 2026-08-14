import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const body = await req.json();
    const { status, founder_notes } = body;

    const updateData: {
      status?: string;
      founder_notes?: string;
    } = {};

    if (status && typeof status === "string") {
      const validStatuses = ["NEW", "REVIEWED", "ACTIONED", "ARCHIVED"];
      if (validStatuses.includes(status.toUpperCase())) {
        updateData.status = status.toUpperCase();
      }
    }

    if (founder_notes !== undefined) {
      updateData.founder_notes = typeof founder_notes === "string" ? founder_notes.trim() : null;
    }

    const updated = await prisma.feedbacks.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      feedback: updated,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to update feedback item";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    await prisma.feedbacks.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: "Feedback deleted successfully" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to delete feedback item";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
