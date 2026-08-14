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

    // Combine all IDs to lookup
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
    const emailList = Array.from(emailToItemMap.keys());
    const seqIdList = Array.from(seqIdToItemMap.keys());

    // ── 1. Fetch Prospects & Reply Statuses by Email ──────────────────────────
    const repliedEmailsSet = new Set<string>();
    const prospectStatusMap = new Map<string, string>(); // email -> status

    if (emailList.length > 0) {
      const prospects = await prisma.prospect.findMany({
        where: {
          email: { in: emailList, mode: "insensitive" },
        },
        select: {
          email: true,
          status: true,
          reply_classifications: {
            where: { reply_type: "REAL_REPLY" },
            select: { id: true },
            take: 1,
          },
        },
      });

      for (const p of prospects) {
        const em = p.email.toLowerCase();
        prospectStatusMap.set(em, p.status);
        if (p.status === "REPLIED" || (p.reply_classifications && p.reply_classifications.length > 0)) {
          repliedEmailsSet.add(em);
        }
      }
    }

    // ── 2. Check tracked_emails table (by source_id OR recipient_email) ──────
    const trackedEmails = await prisma.trackedEmail.findMany({
      where: {
        OR: [
          { source_id: { in: idList } },
          ...(emailList.length > 0 ? [{ recipient_email: { in: emailList, mode: "insensitive" as const } }] : []),
        ],
      },
      select: {
        id: true,
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
    });

    const statusMap = new Map<string, any>();

    for (const email of trackedEmails) {
      const isReplied = email.status === "REPLIED" || repliedEmailsSet.has(email.recipient_email.toLowerCase());
      const effectiveStatus = isReplied ? "REPLIED" : email.status;

      const trackingObj = {
        status: effectiveStatus,
        openCount: email.open_count,
        clickCount: email.click_count,
        lastOpenedAt: email.last_opened_at?.toISOString() || null,
        bouncedAt: email.bounced_at?.toISOString() || null,
        repliedAt: email.replied_at?.toISOString() || (isReplied ? new Date().toISOString() : null),
      };

      if (email.source_id) {
        statusMap.set(email.source_id, { stepId: email.source_id, ...trackingObj });
      }

      // Also map by recipient email for synthetic queueIds
      const mappedQueueIds = emailToItemMap.get(email.recipient_email.toLowerCase());
      if (mappedQueueIds) {
        for (const qId of mappedQueueIds) {
          if (!statusMap.has(qId) || isReplied) {
            statusMap.set(qId, { stepId: qId, ...trackingObj });
          }
        }
      }
    }

    // ── 3. Cross-reference database SequenceSteps ───────────────────────────
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

    for (const step of sequenceSteps) {
      const prospectEmail = step.sequence?.prospect?.email?.toLowerCase();
      const prospectStatus = step.sequence?.prospect?.status;
      const isReplied = prospectStatus === "REPLIED" || (prospectEmail ? repliedEmailsSet.has(prospectEmail) : false);

      let stepStatus = isReplied ? "REPLIED" : step.status;
      if (step.status === "CANCELLED" && isReplied) {
        stepStatus = "CANCELLED"; // Keep CANCELLED for subsequent steps stopped by reply
      }

      const existing = statusMap.get(step.id);
      const trackingObj = {
        stepId: step.id,
        status: isReplied ? "REPLIED" : (existing?.status || stepStatus),
        openCount: existing?.openCount || (isReplied ? 1 : 0),
        clickCount: existing?.clickCount || 0,
        lastOpenedAt: existing?.lastOpenedAt || null,
        bouncedAt: existing?.bouncedAt || null,
        repliedAt: isReplied ? (existing?.repliedAt || new Date().toISOString()) : null,
      };

      statusMap.set(step.id, trackingObj);

      // Map to Smart Import queueId if matching sequence_id + step_number
      if (step.sequence_id) {
        const syntheticQueueId = `${step.sequence_id}_s${step.step_number}`;
        statusMap.set(syntheticQueueId, { ...trackingObj, stepId: syntheticQueueId });
      }

      if (prospectEmail) {
        const queueIdsForEmail = emailToItemMap.get(prospectEmail);
        if (queueIdsForEmail) {
          for (const qId of queueIdsForEmail) {
            if (!statusMap.has(qId) || isReplied) {
              statusMap.set(qId, { ...trackingObj, stepId: qId });
            }
          }
        }
      }
    }

    // ── 4. Build Final Resolution for every requested ID ─────────────────────
    const statuses = idList.map((id) => {
      const found = statusMap.get(id);
      if (found) return found;

      // Check direct email fallback for this specific queueId
      for (const [em, qIds] of emailToItemMap.entries()) {
        if (qIds.includes(id)) {
          if (repliedEmailsSet.has(em)) {
            return {
              stepId: id,
              status: "REPLIED",
              openCount: 1,
              clickCount: 0,
              lastOpenedAt: null,
              bouncedAt: null,
              repliedAt: new Date().toISOString(),
            };
          }
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
    return NextResponse.json({ error: "Failed to fetch tracking statuses" }, { status: 500 });
  }
}
