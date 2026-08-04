import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { stepIds } = await req.json();

    if (!stepIds || !Array.isArray(stepIds) || stepIds.length === 0) {
      return NextResponse.json({ statuses: [] });
    }

    const trackedEmails = await prisma.trackedEmail.findMany({
      where: {
        source_id: {
          in: stepIds
        },
        source_type: "SEQUENCE_STEP"
      },
      select: {
        source_id: true,
        status: true,
        open_count: true,
        click_count: true,
        last_opened_at: true,
        bounced_at: true,
        replied_at: true
      }
    });

    const statuses = trackedEmails.map(email => ({
      stepId: email.source_id,
      status: email.status,
      openCount: email.open_count,
      clickCount: email.click_count,
      lastOpenedAt: email.last_opened_at?.toISOString() || null,
      bouncedAt: email.bounced_at?.toISOString() || null,
      repliedAt: email.replied_at?.toISOString() || null
    }));

    return NextResponse.json({ statuses });
  } catch (error) {
    console.error("[POST /api/track/status] Error:", error);
    return NextResponse.json({ error: "Failed to fetch tracking statuses" }, { status: 500 });
  }
}
