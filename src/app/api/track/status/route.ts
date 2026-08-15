import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

interface TrackItemQuery {
  queueId: string;
  stepId?: string;
  email?: string;
  importSequenceId?: string;
  stepNumber?: number;
  liveStatus?: string;
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
    const emailList = Array.from(emailToItemMap.keys());
    const statusMap = new Map<string, any>();
    
    // 1. Fetch relevant SequenceSteps safely
    const stepOrConditions: any[] = [];
    if (idList.length > 0) stepOrConditions.push({ id: { in: idList } });
    if (seqIdList.length > 0) stepOrConditions.push({ sequence_id: { in: seqIdList } });
    if (emailList.length > 0) stepOrConditions.push({ sequence: { prospect: { email: { in: emailList } } } });

    const sequenceSteps = stepOrConditions.length > 0 ? await prisma.sequenceStep.findMany({
      where: {
        OR: stepOrConditions,
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
    }) : [];

    const realStepIds = sequenceSteps.map(s => s.id);

    // 2. Fetch TrackedEmails safely for these exact steps and emails
    const trackedOrConditions: any[] = [];
    if (realStepIds.length > 0) trackedOrConditions.push({ source_id: { in: realStepIds } });
    if (emailList.length > 0) trackedOrConditions.push({ recipient_email: { in: emailList } });

    const trackedEmails = trackedOrConditions.length > 0 ? await prisma.trackedEmail.findMany({
      where: {
        OR: trackedOrConditions,
      },
      select: {
        source_id: true,
        recipient_email: true,
        status: true,
        open_count: true,
        click_count: true,
        last_opened_at: true,
        bounced_at: true,
        replied_at: true,
      },
      orderBy: { created_at: "desc" },
    }) : [];

    const trackingByStepId = new Map(trackedEmails.filter(t => t.source_id).map(t => [t.source_id!, t]));
    const trackingByEmail = new Map<string, typeof trackedEmails[0]>();
    for (const t of trackedEmails) {
      if (t.recipient_email) {
        const em = t.recipient_email.toLowerCase();
        if (!trackingByEmail.has(em)) {
          trackingByEmail.set(em, t);
        }
      }
    }

    // 3. Map everything back to the requested queueIds
    for (const step of sequenceSteps) {
      const prospectEmail = step.sequence?.prospect?.email?.toLowerCase();
      const prospectStatus = step.sequence?.prospect?.status;
      const isReplied = prospectStatus === "REPLIED";
      
      const tracking = trackingByStepId.get(step.id) || (prospectEmail ? trackingByEmail.get(prospectEmail) : null);
      
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

      // Map to synthetic queueId using email AND step number
      if (prospectEmail) {
        const queueIdsForEmail = emailToItemMap.get(prospectEmail);
        if (queueIdsForEmail) {
          for (const qId of queueIdsForEmail) {
            const match = qId.match(/_s(\d+)(_|$)/);
            const qStepNum = match ? parseInt(match[1], 10) : null;
            if (qStepNum === step.step_number || !qStepNum) {
              statusMap.set(qId, { stepId: qId, ...trackingObj });
            }
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
      const item = items.find((it) => it.queueId === id);

      // If the client item is still SCHEDULED or PROCESSING, do NOT override with historical tracking
      if (item?.liveStatus === "SCHEDULED" || item?.liveStatus === "PROCESSING") {
        return {
          stepId: id,
          status: item.liveStatus,
          openCount: 0,
          clickCount: 0,
          lastOpenedAt: null,
          bouncedAt: null,
          repliedAt: null,
        };
      }

      const found = statusMap.get(id);
      if (found) return found;

      // Fallback: match by item recipient email only for already SENT items
      if (item?.email) {
        const em = item.email.toLowerCase().trim();
        const emailTrack = trackingByEmail.get(em);
        if (emailTrack) {
          const isReplied = emailTrack.status === "REPLIED";
          const isOpened = emailTrack.status === "OPENED" || emailTrack.open_count > 0;
          const currentStatus = isReplied ? "REPLIED" : isOpened ? "OPENED" : emailTrack.status;
          return {
            stepId: id,
            status: currentStatus,
            openCount: emailTrack.open_count || (isOpened ? 1 : 0),
            clickCount: emailTrack.click_count || 0,
            lastOpenedAt: emailTrack.last_opened_at?.toISOString() || null,
            bouncedAt: emailTrack.bounced_at?.toISOString() || null,
            repliedAt: emailTrack.replied_at?.toISOString() || null,
          };
        }
      }

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
    return NextResponse.json({ 
      error: "Failed to fetch tracking statuses",
      detail: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

