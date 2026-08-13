import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // ── Auth Guard — fail closed ──────────────────────────────────────────────
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const prospectId = params.id;

    if (!prospectId) {
      return NextResponse.json({ error: "Prospect ID required" }, { status: 400 });
    }

    // ── Ownership Verification — prevents IDOR cascade delete ────────────────
    // A user must OWN this prospect to reset it. Returns 404 (not 403) to
    // prevent enumeration: the attacker cannot tell if the ID exists but belongs
    // to someone else, vs. if it simply doesn't exist.
    const owned = await prisma.prospect.findUnique({
      where: { id: prospectId, user_id: session.user.id },
      select: { id: true },
    });

    if (!owned) {
      return NextResponse.json({ error: "Prospect not found" }, { status: 404 });
    }

    // Wrap in a transaction to ensure all related data is wiped safely
    await prisma.$transaction([
      // Delete all adhoc emails
      prisma.adhocEmail.deleteMany({
        where: { prospect_id: prospectId }
      }),
      
      // Delete all reply classifications
      prisma.replyClassification.deleteMany({
        where: { prospect_id: prospectId }
      }),
      
      // Delete all sequences (this cascades to SequenceSteps due to schema)
      prisma.sequence.deleteMany({
        where: { prospect_id: prospectId, user_id: session.user.id }
      }),

      // Reset the prospect status back to ACTIVE
      prisma.prospect.update({
        where: { id: prospectId, user_id: session.user.id },
        data: { status: "ACTIVE" }
      })
    ]);

    return NextResponse.json({ ok: true, message: "Prospect completely reset." });
  } catch (error: any) {
    console.error("[PROSPECT_RESET_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to reset prospect", detail: error.message },
      { status: 500 }
    );
  }
}
