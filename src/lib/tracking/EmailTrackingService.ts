import prisma from "@/lib/prisma";

export type TrackingEventType = "QUEUED" | "SENDING" | "SENT" | "DELIVERED" | "OPENED" | "CLICKED" | "REPLIED" | "BOUNCED" | "COMPLAINT";

export interface RegisterEmailParams {
  provider: string;
  senderEmail: string;
  recipientEmail: string;
  subject?: string;
  sourceType: string;
  sourceId?: string;
  userId?: string;
}

export class EmailTrackingService {
  /**
   * Registers a new email for tracking before it is sent.
   * Returns the secure tracking ID.
   */
  public async registerEmail(params: RegisterEmailParams): Promise<string> {
    const trackedEmail = await prisma.trackedEmail.create({
      data: {
        provider: params.provider,
        sender_email: params.senderEmail,
        recipient_email: params.recipientEmail,
        subject: params.subject,
        source_type: params.sourceType,
        source_id: params.sourceId,
        user_id: params.userId,
        status: "QUEUED",
      }
    });

    await prisma.trackingEvent.create({
      data: {
        tracked_email_id: trackedEmail.id,
        event_type: "QUEUED",
      }
    });

    return trackedEmail.id;
  }

  /**
   * Links an external provider identifier (e.g. gmail_message_id) to the internal tracking ID.
   */
  public async setProviderMapping(trackingId: string, providerMessageId: string, providerThreadId?: string): Promise<void> {
    await prisma.trackedEmail.update({
      where: { id: trackingId },
      data: {
        provider_message_id: providerMessageId,
        provider_thread_id: providerThreadId
      }
    });
  }

  /**
   * Ingests a new tracking event and safely updates the state machine.
   * Enforces forward-only transitions.
   */
  public async ingestEvent(
    trackingId: string,
    eventType: TrackingEventType,
    metadata?: any,
    reqData?: { ip?: string, userAgent?: string }
  ): Promise<void> {
    // 1. Log the immutable event independently
    if (prisma.trackingEvent?.create) {
      try {
        await prisma.trackingEvent.create({
          data: {
            tracked_email_id: trackingId,
            event_type: eventType,
            ip_address: reqData?.ip,
            user_agent: reqData?.userAgent,
            metadata: metadata || undefined
          }
        });
      } catch (err) {
        console.error("[EmailTrackingService] Failed to create trackingEvent:", err);
      }
    }

    // 2. Direct State Machine Resolution (Pooler-safe)
    try {
      const trackedEmail = await prisma.trackedEmail.findUnique({
        where: { id: trackingId },
        select: { status: true, open_count: true, click_count: true, first_opened_at: true, source_type: true, source_id: true }
      });

      if (!trackedEmail) return;

      const updates: any = {};
      const currentStatus = trackedEmail.status;
      let nextStatus = currentStatus;

      if (eventType === "OPENED") {
        updates.open_count = (trackedEmail.open_count || 0) + 1;
        updates.last_opened_at = new Date();
        if (!trackedEmail.first_opened_at) {
          updates.first_opened_at = new Date();
        }
        if (currentStatus === "QUEUED" || currentStatus === "SENDING" || currentStatus === "SENT" || currentStatus === "DELIVERED") {
          nextStatus = "OPENED";
        }
      } 
      else if (eventType === "CLICKED") {
        updates.click_count = (trackedEmail.click_count || 0) + 1;
        if (currentStatus !== "REPLIED" && currentStatus !== "BOUNCED" && currentStatus !== "COMPLAINT") {
          nextStatus = "CLICKED";
        }
      }
      else if (eventType === "REPLIED") {
        updates.replied_at = new Date();
        if (currentStatus !== "BOUNCED" && currentStatus !== "COMPLAINT") {
          nextStatus = "REPLIED";
        }
      }
      else if (eventType === "BOUNCED") {
        updates.bounced_at = new Date();
        nextStatus = "BOUNCED";
      }
      else if (eventType === "COMPLAINT") {
        nextStatus = "COMPLAINT";
      }
      else if (eventType === "SENT") {
        if (currentStatus === "QUEUED" || currentStatus === "SENDING") {
          nextStatus = "SENT";
        }
      }
      else if (eventType === "DELIVERED") {
        if (currentStatus === "QUEUED" || currentStatus === "SENDING" || currentStatus === "SENT") {
          nextStatus = "DELIVERED";
        }
      }

      if (nextStatus !== currentStatus) {
        updates.status = nextStatus;
      }

      if (Object.keys(updates).length > 0) {
        await prisma.trackedEmail.update({
          where: { id: trackingId },
          data: updates
        });
      }
    } catch (err) {
      console.error("[EmailTrackingService] Failed to update trackedEmail:", err);
    }
  }

  /**
   * Helper to lookup tracking ID from provider message ID (e.g. for Webhook replies)
   */
  public async getTrackingIdByProviderId(providerMessageId: string): Promise<string | null> {
    const email = await prisma.trackedEmail.findUnique({
      where: { provider_message_id: providerMessageId },
      select: { id: true }
    });
    return email?.id || null;
  }

  /**
   * Ingest an event using the provider's thread ID.
   * Useful when a reply webhook only provides the thread ID or inbound message ID.
   */
  public async ingestEventByProviderThreadId(
    providerThreadId: string, 
    eventType: TrackingEventType,
    metadata?: any,
    recipientEmail?: string
  ): Promise<void> {
    const whereOr: any[] = [];
    if (providerThreadId) {
      whereOr.push({ provider_thread_id: providerThreadId });
      whereOr.push({ provider_message_id: providerThreadId });
    }
    if (recipientEmail) {
      whereOr.push({ recipient_email: { equals: recipientEmail, mode: "insensitive" } });
    }

    if (whereOr.length === 0) return;

    // Find all tracked emails associated with this thread / recipient
    const trackedEmails = await prisma.trackedEmail.findMany({
      where: { OR: whereOr },
      select: { id: true }
    });
    
    // Ingest the event for all associated tracked emails
    // A single reply means the whole conversation is marked as replied.
    for (const email of trackedEmails) {
      await this.ingestEvent(email.id, eventType, metadata);
    }
  }
}

export const emailTrackingService = new EmailTrackingService();
