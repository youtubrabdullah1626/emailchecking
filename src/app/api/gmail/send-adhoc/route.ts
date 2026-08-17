export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { sendSingleAdhocEmail } from "@/lib/gmail/adhoc-sender";

function replaceVariables(text: string, prospect: any) {
  if (!text) return text;
  return text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, variableName) => {
    switch (variableName.toLowerCase()) {
      case "first_name":
        return prospect.name ? prospect.name.split(" ")[0] : "";
      case "last_name":
        const parts = prospect.name ? prospect.name.split(" ") : [];
        return parts.length > 1 ? parts.slice(1).join(" ") : "";
      case "company":
        return prospect.company || "";
      case "email":
        return prospect.email || "";
      case "timezone":
        return prospect.timezone || "";
      default:
        return match;
    }
  });
}

export async function POST(request: NextRequest) {
  // ── Auth Guard ───────────────────────────────────────────────────────────
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const raw = await request.json();
    const { prospectId, subject, body, pauseSequence, scheduledAt, replyToLastThread } = raw;

    if (!prospectId || !subject || !body) {
      return NextResponse.json(
        { ok: false, error: "INVALID_REQUEST", detail: "Missing required fields" },
        { status: 400 }
      );
    }

    // 1. Find prospect — user_id scope prevents cross-tenant send
    const prospect = await prisma.prospect.findUnique({
      where: { id: prospectId, user_id: session.user.id },
      include: {
        users: { select: { email: true } },
        sequences: {
          where: { status: "ACTIVE" },
          select: { id: true }
        }
      }
    });

    if (!prospect) {
      return NextResponse.json({ ok: false, error: "NOT_FOUND", detail: "Prospect not found" }, { status: 404 });
    }

    // Replace variables
    const finalSubject = replaceVariables(subject, prospect);
    const finalBody = replaceVariables(body, prospect);

    // 2. Optional: pause active sequence
    if (pauseSequence && prospect.sequences.length > 0) {
      const activeSequence = prospect.sequences[0];
      await prisma.sequence.update({
        where: { id: activeSequence.id },
        data: { status: "PAUSED" }
      });
    }

    // 3. Create AdhocEmail record in DB
    const parsedScheduledDate = scheduledAt ? new Date(scheduledAt) : null;
    const isFutureSchedule = parsedScheduledDate ? parsedScheduledDate > new Date() : false;
    
    // Find previous thread ID if requested
    let previousThreadId = undefined;
    if (replyToLastThread) {
      const lastAdhoc = await prisma.adhocEmail.findFirst({
        where: { prospect_id: prospect.id, gmail_thread_id: { not: null } },
        orderBy: { sent_at: 'desc' }
      });
      if (lastAdhoc && lastAdhoc.gmail_thread_id) {
        previousThreadId = lastAdhoc.gmail_thread_id;
      }
    }

    const adhocEmail = await prisma.adhocEmail.create({
      data: {
        prospect_id: prospect.id,
        subject: finalSubject,
        body: finalBody,
        status: "PENDING",
        scheduled_at: parsedScheduledDate,
        gmail_message_id: null,
        gmail_thread_id: previousThreadId,
      }
    });

    // If scheduled for the future, return confirmation
    if (isFutureSchedule) {
      return NextResponse.json({
        ok: true,
        messageId: adhocEmail.id,
        status: "SCHEDULED"
      });
    }

    // Dispatch immediately in background
    sendSingleAdhocEmail(adhocEmail.id).catch((err) => {
      console.error("[BACKGROUND_ADHOC_SEND_ERROR]", err);
    });

    return NextResponse.json({
      ok: true,
      messageId: adhocEmail.id,
      status: "SENT"
    });
  } catch (err: any) {
    console.error("[SEND_ADHOC_ERROR]", err);
    return NextResponse.json(
      { ok: false, error: "SEND_FAILED", detail: err.message },
      { status: 500 }
    );
  }
}
