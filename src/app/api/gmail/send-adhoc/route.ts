import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import prisma from "@/lib/prisma";
import { getOAuthConfig, createOAuth2Client } from "@/lib/gmail/oauth";
import { buildGmailMessage } from "@/lib/gmail/message";
import { getSession } from "@/lib/auth/session";

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
    const isScheduled = scheduledAt && new Date(scheduledAt) > new Date();
    
    // Find previous thread ID if requested
    let previousThreadId = undefined;
    if (replyToLastThread) {
      // Find the last sent email in sequences or previous adhoc emails
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
        status: isScheduled ? "PENDING" : "SENT",
        scheduled_at: isScheduled ? new Date(scheduledAt) : null,
        gmail_message_id: null, // Will be updated async
        gmail_thread_id: previousThreadId,
      }
    });

    // If it's scheduled for the future, we return immediately and let the scheduler handle it.
    if (isScheduled) {
      return NextResponse.json({
        ok: true,
        messageId: adhocEmail.id,
        status: "SCHEDULED"
      });
    }

    // 4. Send Email via Gmail API instantly in the background (fire-and-forget)
    (async () => {
      try {
        const config = getOAuthConfig();
        if (!config) throw new Error("Gmail OAuth config missing");
        
        const oauth2Client = createOAuth2Client();
        const messagePayload = buildGmailMessage({
          from: config.senderEmail,
          to: prospect.email,
          toName: prospect.name,
          subject: finalSubject,
          body: finalBody,
          threadId: previousThreadId
        });

        const gmail = google.gmail({ version: "v1", auth: oauth2Client });
        const sendResponse = await gmail.users.messages.send({
          userId: "me",
          requestBody: { raw: messagePayload.raw }
        });

        const gmailMessageId = sendResponse.data.id;
        const gmailThreadId = sendResponse.data.threadId;

        if (gmailMessageId) {
          await prisma.adhocEmail.update({
            where: { id: adhocEmail.id },
            data: {
              gmail_message_id: gmailMessageId,
              gmail_thread_id: gmailThreadId,
              sent_at: new Date()
            }
          });
        }
      } catch (error: any) {
        console.error("[BACKGROUND_GMAIL_SEND_ERROR]", error);
        await prisma.adhocEmail.update({
          where: { id: adhocEmail.id },
          data: {
            status: "FAILED",
            error_message: error.message || "Failed to send email"
          }
        });
      }
    })();

    // Return instantly so the UI feels fast
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
