import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    let targetEmail = email;

    if (!targetEmail) {
      // For personal automation workspace, just get the primary connected account
      const account = await prisma.emailAccount.findFirst({
        orderBy: { updated_at: "desc" },
        select: { email: true }
      });
      if (!account) {
        return NextResponse.json({ success: false, reason: "No accounts found" });
      }
      targetEmail = account.email;
    }

    const account = await prisma.emailAccount.findUnique({
      where: { email: targetEmail }
    });

    if (account) {
      await prisma.emailAccount.update({
        where: { email: targetEmail },
        data: {
          last_seen_at: new Date()
        }
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[POST /api/track-activity] Error:", error);
    // Return 200 even on error so we don't break the frontend silently tracking
    return NextResponse.json({ success: false }); 
  }
}
