import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

interface TrackItemQuery {
  queueId: string;
  email?: string;
  importSequenceId?: string;
  stepNumber?: number;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const stepIds: string[] = Array.isArray(body.stepIds) ? body.stepIds : [];
    const items: TrackItemQuery[] = Array.isArray(body.items) ? body.items : [];

    const allQueryIds = new Set<string>();
    const emailToItemMap = new Map<string, string[]>(); // email -> [queueIds]
    const seqIdToItemMap = new Map<string, string[]>(); // seqId -> [queueIds]

    for (const id of stepIds) {
      if (typeof id === "string" && id.trim()) {
        allQueryIds.add(id.trim());
      }
    }

    for (const item of items) {
      if (item.queueId) {
        allQueryIds.add(item.queueId);
        if (item.email) {
          const em = item.email.toLowerCase().trim();
          const existing = emailToItemMap.get(em) || [];
          existing.push(item.queueId);
          emailToItemMap.set(em, existing);
        }
        if (item.importSequenceId) {
          const sid = item.importSequenceId.trim();
          const existing = seqIdToItemMap.get(sid) || [];
          existing.push(item.queueId);
          seqIdToItemMap.set(sid, existing);
        }
      }
    }

    if (allQueryIds.size === 0 && emailToItemMap.size === 0) {
      return NextResponse.json({ statuses: [] });
    }

    const idList = Array.from(allQueryIds);
    const seqIdList = Array.from(seqIdToItemMap.keys());
    const statusMap = new Map<string, any>();
    
    // 1. Fetch relevant SequenceSteps
    const sequenceSteps = await prisma.sequenceStep.findMany({
      where: {
        OR: [
          { id: { in: idList } },
          ...(seqIdList.length > 0 ? [{ sequence_id: { in: seqIdList } }] : []),
        ],
      },
      select: {
        id: true,
        sequence_id: true,
        step_number: true,
        status: true,
        sequence: {
          select: {
            id: true,
            status: true,
            prospect: {
              select: {
                id: true,
                email: true,
                status: true,
              },
            },
          },
        },
      },
    });

    const realStepIds = sequenceSteps.map(s => s.id);

    // 2. Fetch TrackedEmails for these exact steps
    const trackedEmails = await prisma.trackedEmail.findMany({
      where: {
        source_id: { in: realStepIds },
      },
      select: {
        source_id: true,
        status: true,
        open_count: true,
        click_count: true,
        last_opened_at: true,
        bounced_at: true,
        replied_at: true,
      },
    });

    const trackingByStepId = new Map(trackedEmails.map(t => [t.source_id, t]));

    // 3. Map everything back to the requested queueIds
    for (const step of sequenceSteps) {
      const prospectEmail = step.sequence?.prospect?.email?.toLowerCase();
      const prospectStatus = step.sequence?.prospect?.status;
      const isReplied = prospectStatus === "REPLIED";
      
      const tracking = trackingByStepId.get(step.id);
      
      let stepStatus = isReplied ? "REPLIED" : (tracking?.status || step.status);
      if (step.status === "CANCELLED" && isReplied) {
        stepStatus = "CANCELLED";
      }

      const trackingObj = {
        status: stepStatus,
        openCount: tracking?.open_count || (isReplied ? 1 : 0),
        clickCount: tracking?.click_count || 0,
        lastOpenedAt: tracking?.last_opened_at?.toISOString() || null,
        bouncedAt: tracking?.bounced_at?.toISOString() || null,
        repliedAt: isReplied 
          ? (tracking?.replied_at?.toISOString() || new Date().toISOString()) 
          : (tracking?.replied_at?.toISOString() || null),
      };

      // Map to exact step ID
      statusMap.set(step.id, { stepId: step.id, ...trackingObj });

      // Map to synthetic queueId using email
      if (prospectEmail) {
        const queueIdsForEmail = emailToItemMap.get(prospectEmail);
        if (queueIdsForEmail) {
          for (const qId of queueIdsForEmail) {
            statusMap.set(qId, { stepId: qId, ...trackingObj });
          }
        }
      }
      
      // Map to synthetic queueId using sequence_id + step_number
      if (step.sequence_id) {
        const syntheticQueueId = `${step.sequence_id}_s${step.step_number}`;
        statusMap.set(syntheticQueueId, { stepId: syntheticQueueId, ...trackingObj });
      }
    }

    // 4. Build Final Resolution
    const statuses = idList.map((id) => {
      const found = statusMap.get(id);
      if (found) return found;

      return {
        stepId: id,
        status: "SCHEDULED",
        openCount: 0,
        clickCount: 0,
        lastOpenedAt: null,
        bouncedAt: null,
        repliedAt: null,
      };
    });

    return NextResponse.json({ statuses });
  } catch (error) {
    console.error("[POST /api/track/status] Error:", error);
    return NextResponse.json({ error: "Failed to fetch tracking statuses" }, { status: 500 });
  }
}

