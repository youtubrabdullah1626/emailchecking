import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { stepIds } = await req.json();

    if (!stepIds || !Array.isArray(stepIds) || stepIds.length === 0) {
      return NextResponse.json({ statuses: [] });
    }

    // 1. Check tracked_emails table
    const trackedEmails = await prisma.trackedEmail.findMany({
      where: {
        source_id: { in: stepIds },
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

    const statusMap = new Map<string, any>();
    for (const email of trackedEmails) {
      statusMap.set(email.source_id, {
        stepId: email.source_id,
        status: email.status,
        openCount: email.open_count,
        clickCount: email.click_count,
        lastOpenedAt: email.last_opened_at?.toISOString() || null,
        bouncedAt: email.bounced_at?.toISOString() || null,
        repliedAt: email.replied_at?.toISOString() || null
      });
    }

    // 2. Cross-reference with database sequenceStep & prospect records for 100% accurate state
    const sequenceSteps = await prisma.sequenceStep.findMany({
      where: {
        id: { in: stepIds }
      },
      select: {
        id: true,
        status: true,
        sequence: {
          select: {
            prospect: {
              select: {
                status: true,
                email: true
              }
            }
          }
        }
      }
    });

    for (const step of sequenceSteps) {
      const prospectStatus = step.sequence?.prospect?.status;
      const existing = statusMap.get(step.id);
      
      let finalStatus = existing?.status || "SENT";
      if (prospectStatus === "REPLIED") {
        finalStatus = "REPLIED";
      }

      statusMap.set(step.id, {
        stepId: step.id,
        status: finalStatus,
        openCount: existing?.openCount || 0,
        clickCount: existing?.clickCount || 0,
        lastOpenedAt: existing?.lastOpenedAt || null,
        bouncedAt: existing?.bouncedAt || null,
        repliedAt: existing?.repliedAt || null
      });
    }

    // 3. Fallback for synthetic Smart Import queueIds (e.g. searching by prospect email if replied)
    const repliedProspects = await prisma.prospect.findMany({
      where: { status: "REPLIED" },
      select: { email: true }
    });
    const repliedEmails = new Set(repliedProspects.map(p => p.email.toLowerCase()));

    const statuses = stepIds.map(id => {
      const found = statusMap.get(id);
      if (found) return found;

      // Check if any part of synthetic ID matches a replied prospect
      const isReplied = Array.from(repliedEmails).some(email => id.toLowerCase().includes(email));
      if (isReplied) {
        return {
          stepId: id,
          status: "REPLIED",
          openCount: 1,
          clickCount: 0,
          lastOpenedAt: null,
          bouncedAt: null,
          repliedAt: new Date().toISOString()
        };
      }

      return {
        stepId: id,
        status: "SCHEDULED",
        openCount: 0,
        clickCount: 0,
        lastOpenedAt: null,
        bouncedAt: null,
        repliedAt: null
      };
    });

    return NextResponse.json({ statuses });
  } catch (error) {
    console.error("[POST /api/track/status] Error:", error);
    return NextResponse.json({ error: "Failed to fetch tracking statuses" }, { status: 500 });
  }
}
