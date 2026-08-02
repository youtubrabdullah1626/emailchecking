/**
 * POST /api/webhooks/gmail
 *
 * Gmail Push Notification Receiver
 *
 * Google Cloud PubSub delivers push notifications here when the Gmail mailbox
 * changes (new message, label change, etc.). This route must:
 *
 *   1. Respond 200 as fast as possible — PubSub retries if no 200 within 30s
 *   2. Verify the request is from Google (GMAIL_WEBHOOK_SECRET token check)
 *   3. Decode the base64 PubSub envelope to extract the Gmail notification
 *   4. Run the reply tracker engine synchronously (process then return 200)
 *   5. Return 500 on transient errors — PubSub will retry automatically
 *
 * Security:
 *   Google Cloud PubSub does not natively sign push payloads. The recommended
 *   approach is to embed a secret token in the push subscription URL:
 *     https://yourdomain.com/api/webhooks/gmail?token=GMAIL_WEBHOOK_SECRET
 *   This route validates that token before processing anything.
 *
 * Idempotency:
 *   The engine checks reply_classifications.gmail_message_id (unique constraint)
 *   before processing — duplicate PubSub deliveries are safe.
 *
 * PubSub retry behaviour:
 *   - 200 OK  → PubSub considers the message acknowledged (success)
 *   - 5xx     → PubSub retries with exponential backoff (transient failure)
 *   - 4xx     → PubSub does NOT retry (permanent failure — use carefully)
 *
 * One-time Google Cloud setup:
 *   1. Create a PubSub topic: projects/{project}/topics/gmail-replies
 *   2. Grant gmail-api-push@system.gserviceaccount.com the "Pub/Sub Publisher" role
 *   3. Create a push subscription with endpoint:
 *      https://yourdomain.com/api/webhooks/gmail?token={GMAIL_WEBHOOK_SECRET}
 *   4. Register the Gmail watch: POST /api/gmail/watch
 */

import { NextRequest, NextResponse } from "next/server";
import { processPushNotification } from "@/lib/reply-tracker/engine";
import type { PubSubPushBody, GmailPushNotification } from "@/lib/reply-tracker/types";
import { logger } from "@/lib/observability/logger";
import { withObservability } from "@/lib/observability/middleware";

// ── Token verification ────────────────────────────────────────────────────────

function verifyWebhookToken(request: NextRequest): boolean {
  const secret = process.env.GMAIL_WEBHOOK_SECRET;

  // If no secret is configured, allow in development only
  if (!secret) {
    return process.env.NODE_ENV === "development";
  }

  const token = request.nextUrl.searchParams.get("token");
  return token === secret;
}

// ── Payload decoding ──────────────────────────────────────────────────────────

function decodePushPayload(body: PubSubPushBody): GmailPushNotification | null {
  try {
    const raw = Buffer.from(body.message.data, "base64").toString("utf-8");
    const parsed = JSON.parse(raw) as GmailPushNotification;

    if (!parsed.emailAddress || !parsed.historyId) return null;

    return parsed;
  } catch {
    return null;
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export const POST = withObservability(async (request: NextRequest): Promise<NextResponse> => {
  // ── 1. Verify token ───────────────────────────────────────────────────────
  if (!verifyWebhookToken(request)) {
    logger.warn("tracker_webhook_unauthorized", { detail: "Invalid or missing webhook token." });
    // Return 200 even on auth failure — returning 4xx would cause PubSub to
    // stop retrying, which could permanently lose notifications if the secret
    // is misconfigured. Log and discard instead.
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 200 });
  }

  // ── 2. Parse body ─────────────────────────────────────────────────────────
  let body: PubSubPushBody;
  try {
    body = await request.json();
  } catch {
    logger.error("tracker_webhook_invalid_payload", { detail: "Failed to parse request body as JSON." });
    return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 200 });
  }

  // ── 3. Decode PubSub envelope ─────────────────────────────────────────────
  if (!body?.message?.data) {
    logger.error("tracker_webhook_invalid_payload", { detail: "PubSub message missing data field." });
    return NextResponse.json({ ok: false, error: "MISSING_DATA" }, { status: 200 });
  }

  const notification = decodePushPayload(body);
  if (!notification) {
    logger.error("tracker_webhook_invalid_payload", { detail: "Failed to decode Gmail notification from PubSub data." });
    return NextResponse.json({ ok: false, error: "INVALID_NOTIFICATION" }, { status: 200 });
  }

  logger.info("tracker_webhook_received", {
    emailAddress: notification.emailAddress,
    historyId: notification.historyId,
    pubSubMessageId: body.message.messageId,
  });

  // ── 4. Process notification ───────────────────────────────────────────────
  // Run synchronously — the engine handles all internal errors gracefully.
  // Return 500 only if the engine itself throws unexpectedly (triggers PubSub retry).
  try {
    const result = await processPushNotification(notification);

    if (!result.success) {
      // Engine encountered a transient error (e.g. DB unavailable, history expired).
      // Return 500 so PubSub retries this notification.
      return NextResponse.json(
        { ok: false, detail: "Engine processing failed — will retry." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      messagesFound: result.messagesFound,
      durationMs: result.durationMs,
    });
  } catch (err) {
    // Unexpected engine crash — return 500 for PubSub retry
    const msg = err instanceof Error ? err.message : "Unknown error";
    logger.error("tracker_engine_error", { detail: `Unhandled engine error: ${msg}`, error: err });
    return NextResponse.json(
      { ok: false, error: "ENGINE_ERROR" },
      { status: 500 }
    );
  }
});

// Gmail sends GET to verify the endpoint exists during PubSub subscription setup
export const GET = withObservability(async (): Promise<NextResponse> => {
  return NextResponse.json({ ok: true, service: "gmail-reply-tracker" });
});
