import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const prospectId = params.id;

    if (!prospectId) {
      return NextResponse.json({ error: "Prospect ID required" }, { status: 400 });
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
        where: { prospect_id: prospectId }
      }),

      // Reset the prospect status back to ACTIVE
      prisma.prospect.update({
        where: { id: prospectId },
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
