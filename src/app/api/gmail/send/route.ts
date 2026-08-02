export const dynamic = "force-dynamic";
/**
 * POST /api/gmail/send
 *
 * Gmail Send Endpoint — Phase 5
 *
 * Sends emails for a given list of claimed step IDs.
 * Called after the scheduler (Phase 4) runs and returns claimedStepIds.
 *
 * INTERNAL ENDPOINT — Phase 5
 *
 * ⚠ This endpoint is unprotected in Phase 5 (single-user personal tool,
 *    no authentication yet). It MUST be protected before production use
 *    or sharing the app with anyone.
 *
 * Request body:
 *   { "stepIds": ["step-abc", "step-def", ...] }
 *
 * Or run the full scheduler+send pipeline in one call:
 *   { "runSchedulerFirst": true }
 *   This calls the scheduler, gets claimedStepIds, then sends all of them.
 *
 * Response 200:
 *   {
 *     "startedAt": "...",
 *     "finishedAt": "...",
 *     "durationMs": 1234,
 *     "total": 2,
 *     "sent": 2,
 *     "failed": 0,
 *     "aborted": 0,
 *     "configErrors": 0,
 *     "results": [...],
 *     "status": "SUCCESS"
 *   }
 *
 * The response NEVER contains:
 *   - OAuth tokens or secrets
 *   - Email body text
 *   - Raw stack traces
 *   - Database connection strings
 *
 * Local development usage:
 *
 *   # Step 1: run scheduler to claim steps
 *   curl -X POST http://localhost:3000/api/scheduler/run
 *
 *   # Step 2: send the claimed steps
 *   curl -X POST http://localhost:3000/api/gmail/send \
 *     -H "Content-Type: application/json" \
 *     -d '{"stepIds": ["<claimed-step-id-1>", "<claimed-step-id-2>"]}'
 *
 *   # Or do both in one call:
 *   curl -X POST http://localhost:3000/api/gmail/send \
 *     -H "Content-Type: application/json" \
 *     -d '{"runSchedulerFirst": true}'
 */

import { NextRequest, NextResponse } from "next/server";
import { sendBatch } from "@/lib/gmail/sender";
import { runScheduler } from "@/lib/scheduler/run";
import { verifySchedulerSecret, unauthorizedResponse } from "@/lib/auth/scheduler-auth";

export async function POST(request: NextRequest) {
  // ── Authentication guard ──────────────────────────────────────────────────
  const auth = verifySchedulerSecret(request);
  if (!auth.authorized) return unauthorizedResponse(auth.reason);

  let body: { stepIds?: unknown; runSchedulerFirst?: unknown } = {};

  try {
    body = await request.json();
  } catch {
    // Empty body or invalid JSON — will use defaults below
  }

  let stepIds: string[] = [];

  // ── Option A: run scheduler first, then send its claimed steps ────────────
  if (body.runSchedulerFirst === true) {
    try {
      const schedulerResult = await runScheduler({ dryRun: false });
      stepIds = schedulerResult.claimedStepIds;

      if (stepIds.length === 0) {
        return NextResponse.json({
          message: "Scheduler ran successfully but found no steps due for sending.",
          schedulerResult,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      return NextResponse.json(
        { error: "Scheduler failed to run.", detail: msg },
        { status: 500 }
      );
    }
  }
  // ── Option B: caller provides explicit step IDs ────────────────────────────
  else if (Array.isArray(body.stepIds)) {
    // Validate that all IDs are strings
    const invalid = body.stepIds.filter((id) => typeof id !== "string");
    if (invalid.length > 0) {
      return NextResponse.json(
        { error: "stepIds must be an array of strings." },
        { status: 400 }
      );
    }
    stepIds = body.stepIds as string[];

    if (stepIds.length === 0) {
      return NextResponse.json(
        { error: "stepIds array is empty. Provide at least one step ID." },
        { status: 400 }
      );
    }

    // Safety limit: cap at 50 per request to prevent accidental runaway
    if (stepIds.length > 50) {
      return NextResponse.json(
        { error: "stepIds exceeds the maximum of 50 per request." },
        { status: 400 }
      );
    }
  }
  // ── No valid input ────────────────────────────────────────────────────────
  else {
    return NextResponse.json(
      {
        error: "Invalid request body.",
        instructions:
          "Provide { stepIds: ['id1', 'id2'] } or { runSchedulerFirst: true }.",
      },
      { status: 400 }
    );
  }

  try {
    const result = await sendBatch(stepIds);
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Gmail send batch failed.", detail: msg },
      { status: 500 }
    );
  }
}

// Reject non-POST methods
export async function GET() {
  return NextResponse.json(
    {
      error: "Method not allowed.",
      instructions: "POST with { stepIds: [...] } or { runSchedulerFirst: true }.",
    },
    { status: 405 }
  );
}

