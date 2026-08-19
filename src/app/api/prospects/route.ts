/**
 * API Route — /api/prospects
 *
 * GET  /api/prospects        → list all prospects for the authenticated user
 * POST /api/prospects        → create a new prospect owned by the authenticated user
 *
 * Server-side only. Prisma is never called from the client.
 * Input is always validated before any DB operation.
 * Errors are always returned as user-friendly messages — no stack traces.
 */

import { NextRequest, NextResponse } from "next/server";
import { createProspect } from "@/lib/db/prospects";
import { validateProspectCreate } from "@/lib/validations/prospect";
import prisma from "@/lib/prisma";
import { auditService } from "@/lib/audit/audit.service";
import { getNetworkContext } from "@/lib/audit/network";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "50", 10);
  const skip = (page - 1) * limit;

  try {
    // Query directly with user_id — bypasses DAL which lacks tenant param
    const [total, rawProspects] = await prisma.$transaction([
      prisma.prospect.count({ where: { user_id: session.user.id } }),
      prisma.prospect.findMany({
        where: { user_id: session.user.id },
        skip,
        take: limit,
        orderBy: { created_at: "desc" },
        include: {
          campaign: { select: { id: true, name: true } },
          sequences: {
            orderBy: { created_at: "desc" },
            take: 1,
            select: {
              id: true,
              status: true,
              steps: {
                select: {
                  id: true,
                  step_number: true,
                  status: true,
                  sent_at: true,
                },
                orderBy: { step_number: "asc" },
              },
            },
          },
        },
      }),
    ]);

    const prospectIds = rawProspects.map((p) => p.id);
    const prospectEmails = rawProspects.map((p) => p.email.toLowerCase());

    // Fetch adhoc emails, tracked emails, and reply classifications in parallel
    const [adhocEmails, trackedEmails, replyClassifications] = await Promise.all([
      prisma.adhocEmail.findMany({
        where: { prospect_id: { in: prospectIds } },
        select: {
          prospect_id: true,
          status: true,
          sent_at: true,
          scheduled_at: true,
        },
      }),
      prisma.trackedEmail.findMany({
        where: {
          recipient_email: { in: prospectEmails, mode: "insensitive" },
        },
        select: {
          recipient_email: true,
          status: true,
          created_at: true,
          first_opened_at: true,
          last_opened_at: true,
          replied_at: true,
        },
      }),
      prisma.replyClassification.findMany({
        where: {
          prospect_id: { in: prospectIds },
          reply_type: "REAL_REPLY",
        },
        select: {
          prospect_id: true,
          classified_at: true,
        },
      }),
    ]);

    // Grouping by prospect
    const adhocByProspect = new Map<string, typeof adhocEmails>();
    for (const a of adhocEmails) {
      const list = adhocByProspect.get(a.prospect_id) || [];
      list.push(a);
      adhocByProspect.set(a.prospect_id, list);
    }

    const trackedByEmail = new Map<string, typeof trackedEmails>();
    for (const t of trackedEmails) {
      if (t.recipient_email) {
        const em = t.recipient_email.toLowerCase();
        const list = trackedByEmail.get(em) || [];
        list.push(t);
        trackedByEmail.set(em, list);
      }
    }

    const replyClassificationSet = new Set(replyClassifications.map((r) => r.prospect_id));

    // Build enriched prospects
    const prospects = rawProspects.map((p) => {
      const latestSequence = p.sequences[0] || null;
      const adhocList = adhocByProspect.get(p.id) || [];
      const trackedList = trackedByEmail.get(p.email.toLowerCase()) || [];
      const hasReplyClassification = replyClassificationSet.has(p.id);

      // Check if replied
      const hasRepliedTracked = trackedList.some((t) => t.status === "REPLIED" || t.replied_at != null);
      const isReplied = p.status === "REPLIED" || hasReplyClassification || hasRepliedTracked;

      // Check if sent/contacted
      const hasSentAdhoc = adhocList.some((a) => a.status === "SENT" || a.sent_at != null);
      const hasSentStep = latestSequence?.steps.some((s) => s.status === "SENT" || s.sent_at != null);
      const allStepsSent = Boolean(latestSequence?.steps && latestSequence.steps.length > 0 && latestSequence.steps.every((s) => s.status === "SENT"));
      const hasTracked = trackedList.length > 0;
      const isContacted = hasSentAdhoc || hasSentStep || hasTracked;

      if (allStepsSent && latestSequence && latestSequence.status !== "STOPPED") {
        latestSequence.status = "COMPLETED";
      }

      // Compute status
      let computedStatus = p.status;
      if (isReplied) {
        computedStatus = "REPLIED";
        if (latestSequence && latestSequence.status === "ACTIVE") {
          latestSequence.status = "STOPPED";
        }
      } else if (latestSequence?.status === "ACTIVE") {
        computedStatus = "ACTIVE";
      } else if (latestSequence?.status === "COMPLETED" || allStepsSent) {
        computedStatus = "COMPLETED";
      } else if (latestSequence?.status === "STOPPED") {
        computedStatus = "STOPPED";
      }

      // Compute lastActivityAt
      const timestamps: Date[] = [p.created_at];
      for (const a of adhocList) {
        if (a.sent_at) timestamps.push(a.sent_at);
        if (a.scheduled_at) timestamps.push(a.scheduled_at);
      }
      for (const s of latestSequence?.steps || []) {
        if (s.sent_at) timestamps.push(s.sent_at);
      }
      for (const t of trackedList) {
        if (t.replied_at) timestamps.push(t.replied_at);
        if (t.last_opened_at) timestamps.push(t.last_opened_at);
        if (t.first_opened_at) timestamps.push(t.first_opened_at);
        if (t.created_at) timestamps.push(t.created_at);
      }

      let latestActivity = p.created_at;
      if (timestamps.length > 0) {
        latestActivity = new Date(Math.max(...timestamps.map((d) => d.getTime())));
      }

      return {
        ...p,
        status: computedStatus,
        isContacted,
        sequence: latestSequence,
        lastActivityAt: latestActivity.toISOString(),
      };
    });

    // Sort prospects by latest activity timestamp descending (most recently sent/active first)
    prospects.sort((a, b) => {
      const timeA = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : new Date(a.created_at).getTime();
      const timeB = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : new Date(b.created_at).getTime();
      return timeB - timeA;
    });

    // Auto-heal: Stop active sequences in database for prospects that replied
    const repliedWithActiveSeqIds = prospects
      .filter((p) => p.status === "REPLIED" && p.sequences && p.sequences[0]?.status === "ACTIVE")
      .map((p) => p.sequences[0].id);

    if (repliedWithActiveSeqIds.length > 0) {
      prisma.sequence.updateMany({
        where: { id: { in: repliedWithActiveSeqIds } },
        data: { status: "STOPPED" },
      }).catch(() => {});
    }

    const totalPages = Math.ceil(total / limit);
    return NextResponse.json({
      data: prospects,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      },
    });
  } catch (error: any) {
    console.error("Failed to fetch prospects", error);
    return NextResponse.json({ error: "Failed to load prospects." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON in request body." }, { status: 400 });
  }

  const validation = validateProspectCreate(body);
  if (!validation.valid) {
    return NextResponse.json(
      { error: "Validation failed.", errors: validation.errors },
      { status: 422 }
    );
  }

  // FIXED: user_id comes from the verified session, not from findFirst()
  const result = await createProspect({
    ...validation.sanitized!,
    user_id: session.user.id,
  });

  if (!result.ok) {
    if (result.error === "DUPLICATE_EMAIL") {
      return NextResponse.json(
        { error: result.message, errors: [{ field: "email", message: result.message }] },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: result.message }, { status: 500 });
  }

  const network = getNetworkContext(request);
  auditService.logAction(
    session.user.id,
    session.user.email,
    "Prospect Created",
    "PROSPECT",
    result.data.email,
    "Prospect",
    "SUCCESS",
    {
      resourceId: result.data.id,
      ipAddress: network.ipAddress,
      deviceInfo: network.deviceInfo,
      metadata: {
        source: "MANUAL",
        company: result.data.company,
        country: network.country,
        browser: network.browser,
        os: network.os,
      },
    }
  );

  return NextResponse.json({ data: result.data }, { status: 201 });
}
