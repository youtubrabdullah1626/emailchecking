import prisma from "@/lib/prisma";
import { google } from "googleapis";
import { getOAuthConfig, createOAuth2Client, createOAuth2ClientForAccount } from "@/lib/gmail/oauth";
import { buildGmailMessage } from "@/lib/gmail/message";
import { EmailTrackingService } from "@/lib/tracking/EmailTrackingService";
import { TrackingInjector } from "@/lib/tracking/TrackingInjector";
import { logger } from "@/lib/observability/logger";

const trackingService = new EmailTrackingService();

function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL;
  if (process.env.RAILWAY_STATIC_URL) return `https://${process.env.RAILWAY_STATIC_URL}`;
  return "https://reachiq.up.railway.app";
}

/**
 * Process a single AdhocEmail record by ID and dispatch through Gmail.
 * Guarantees exactly-once delivery via atomic state locking.
 */
export async function sendSingleAdhocEmail(adhocId: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    // 1. Atomic distributed claim lock — ensures ONLY ONE worker/thread can ever send this email
    const claim = await prisma.adhocEmail.updateMany({
      where: {
        id: adhocId,
        status: "PENDING",
        gmail_message_id: null
      },
      data: {
        gmail_message_id: "IN_FLIGHT"
      }
    });

    if (claim.count === 0) {
      // Already claimed, currently in-flight, or already sent by another process
      return { success: true };
    }

    const adhoc = await prisma.adhocEmail.findUnique({
      where: { id: adhocId },
      include: {
        prospect: {
          include: {
            users: {
              select: { id: true, email: true }
            }
          }
        }
      }
    });

    if (!adhoc) {
      return { success: false, error: "Adhoc email not found" };
    }

    const prospect = adhoc.prospect;
    const userId = prospect.user_id;

    // Resolve OAuth authentication: priority given to user's connected email account
    let oauth2Client: any = null;
    let senderEmail = "";
    const envConfig = getOAuthConfig();

    if (userId) {
      const connectedAccount = await prisma.emailAccount.findFirst({
        where: { user_id: userId, connection_status: "CONNECTED" },
        orderBy: { updated_at: "desc" }
      });

      if (connectedAccount && connectedAccount.refresh_token) {
        oauth2Client = await createOAuth2ClientForAccount(connectedAccount.email);
        senderEmail = connectedAccount.email;
      }
    }

    if (!oauth2Client && envConfig) {
      oauth2Client = createOAuth2Client();
      senderEmail = envConfig.senderEmail;
    }

    if (!oauth2Client) {
      throw new Error("No connected Gmail account or OAuth configuration available for sending.");
    }

    // Register email tracking
    let trackingId: string | null = null;
    try {
      trackingId = await trackingService.registerEmail({
        provider: "GMAIL",
        senderEmail: senderEmail,
        recipientEmail: prospect.email,
        subject: adhoc.subject || undefined,
        sourceType: "ADHOC",
        sourceId: adhoc.id,
        userId: userId || undefined
      });
    } catch (trackErr) {
      logger.warn("Failed to register tracking for adhoc email", { error: trackErr });
    }

    // Build email body with optional tracking pixel
    let finalHtmlBody = adhoc.body;
    if (trackingId) {
      const pixel = TrackingInjector.generatePixel(trackingId, getBaseUrl());
      if (pixel) {
        finalHtmlBody += `\n${pixel}`;
      }
    }

    const messagePayload = buildGmailMessage({
      from: senderEmail,
      to: prospect.email,
      toName: prospect.name,
      subject: adhoc.subject,
      body: finalHtmlBody,
      threadId: adhoc.gmail_thread_id ?? undefined
    });

    const gmail = google.gmail({ version: "v1", auth: oauth2Client });
    const sendResponse = await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw: messagePayload.raw }
    });

    const gmailMessageId = sendResponse.data.id;
    const gmailThreadId = sendResponse.data.threadId;

    if (gmailMessageId && trackingId) {
      await trackingService.setProviderMapping(trackingId, gmailMessageId, gmailThreadId || undefined).catch(() => {});
      await trackingService.ingestEvent(trackingId, "SENT").catch(() => {});
    }

    await prisma.adhocEmail.update({
      where: { id: adhoc.id },
      data: {
        status: "SENT",
        sent_at: new Date(),
        gmail_message_id: gmailMessageId || null,
        gmail_thread_id: gmailThreadId || adhoc.gmail_thread_id || null,
        error_message: null
      }
    });

    // If prospect was previously marked REPLIED, reset to ACTIVE since a new email was sent
    if (prospect.status === "REPLIED") {
      await prisma.prospect.update({
        where: { id: prospect.id },
        data: { status: "ACTIVE" }
      }).catch(() => {});
    }

    return { success: true, messageId: gmailMessageId || undefined };
  } catch (err: any) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error("send_single_adhoc_error", { adhocId, error: errorMsg });

    await prisma.adhocEmail.update({
      where: { id: adhocId },
      data: {
        status: "FAILED",
        gmail_message_id: null,
        error_message: errorMsg
      }
    }).catch(() => {});

    return { success: false, error: errorMsg };
  }
}

/**
 * Sweeps and sends all pending adhoc emails whose scheduled time has arrived.
 * Excludes instant emails (scheduled_at IS NULL) to prevent race conditions with user actions.
 */
export async function sendDueAdhocEmails(limit = 20): Promise<{ processed: number; sent: number; failed: number }> {
  const now = new Date();

  // Auto-recover any stale IN_FLIGHT adhoc records older than 5 minutes (in case of server restart mid-send)
  const staleThreshold = new Date(Date.now() - 5 * 60 * 1000);
  await prisma.adhocEmail.updateMany({
    where: {
      status: "PENDING",
      gmail_message_id: "IN_FLIGHT",
      scheduled_at: { lte: staleThreshold, not: null }
    },
    data: {
      gmail_message_id: null
    }
  }).catch(() => {});

  // Find due pending scheduled emails (strictly future-scheduled items whose time has passed)
  const dueAdhocs = await prisma.adhocEmail.findMany({
    where: {
      status: "PENDING",
      scheduled_at: { lte: now, not: null },
      gmail_message_id: null
    },
    take: limit,
    orderBy: { id: "asc" }
  });

  if (dueAdhocs.length === 0) {
    return { processed: 0, sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;

  for (const adhoc of dueAdhocs) {
    const res = await sendSingleAdhocEmail(adhoc.id);
    if (res.success) {
      sent++;
    } else {
      failed++;
    }
  }

  return { processed: dueAdhocs.length, sent, failed };
}
