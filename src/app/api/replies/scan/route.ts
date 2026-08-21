export const dynamic = "force-dynamic";
/**
 * POST /api/replies/scan
 *
 * Reply Detection Endpoint — Phase 6
 *
 * Triggers a full reply scan across all active sequences.
 * For each sequence with a Gmail thread ID, fetches the thread metadata,
 * classifies inbound messages, and applies stop logic for confirmed real replies.
 *
 * INTERNAL ENDPOINT — Phase 11
 *
 * Protected by SCHEDULER_SECRET via Authorization: Bearer header.
 *
 * Response 200:
 *   {
 *     "startedAt": "...",
 *     "finishedAt": "...",
 *     "durationMs": 1234,
 *     "threadsScanned": 3,
 *     "noReplies": 2,
 *     "autoReplies": 0,
 *     "needsReview": 0,
 *     "realReplies": 1,
 *     "alreadyStopped": 0,
 *     "errors": 0,
 *     "results": [...],
 *     "status": "SUCCESS"
 *   }
 *
 * The response NEVER contains:
 *   - OAuth tokens or secrets
 *   - Full email body content
 *   - Database connection strings
 *   - Raw stack traces
 *
 * Local development usage:
 *
 *   # Scan for replies and apply stop logic
 *   curl -X POST http://localhost:3000/api/replies/scan
 *
 * Prerequisites:
 *   - Gmail OAuth must be configured (GMAIL_REFRESH_TOKEN in .env.local)
 *   - The refresh token must have the gmail.readonly scope
 *     (re-run the /api/auth/gmail setup flow if you previously only granted gmail.send)
 */

import { NextRequest, NextResponse } from "next/server";
import { scanForReplies } from "@/lib/reply/scanner";
import { verifySchedulerSecret, unauthorizedResponse } from "@/lib/auth/scheduler-auth";

let isScanInProgress = false;
let lastScanStartTime = 0;

export async function POST(request: NextRequest) {
  // ── Concurrency guard with 20s auto-stale release ─────────────────────────
  if (isScanInProgress && Date.now() - lastScanStartTime < 20000) {
    return NextResponse.json({
      status: "SUCCESS",
      threadsScanned: 0,
      realReplies: 0,
      message: "A reply scan is already running in background.",
    });
  }

  // ── Authentication guard ──────────────────────────────────────────────────
  // Allow same-origin UI calls from browser dashboard without requiring bearer token
  const isSameOrigin = request.headers.get("sec-fetch-site") === "same-origin" ||
                       request.headers.get("sec-fetch-site") === "same-site" ||
                       process.env.NODE_ENV === "development";

  if (!isSameOrigin) {
    const auth = verifySchedulerSecret(request);
    if (!auth.authorized) return unauthorizedResponse(auth.reason);
  }

  try {
    isScanInProgress = true;
    lastScanStartTime = Date.now();
    const result = await scanForReplies();
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Reply scan failed.", detail: msg },
      { status: 500 }
    );
  } finally {
    isScanInProgress = false;
  }
}

export async function GET() {
  return NextResponse.json(
    {
      error: "Method not allowed.",
      instructions: "POST to /api/replies/scan to trigger a reply scan.",
    },
    { status: 405 }
  );
}

