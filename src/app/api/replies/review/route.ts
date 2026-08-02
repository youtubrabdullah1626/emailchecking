export const dynamic = "force-dynamic";
/**
 * GET & POST /api/replies/review
 *
 * Operator Review Queue API Endpoint — Phase 7
 *
 * GET: Returns pending reply review items for human operator inspection.
 * POST: Handles validated human operator decisions (CONFIRM_STOP | KEEP_ACTIVE | DISMISS).
 *
 * Security & Architecture Rules:
 *   - No direct database writes from client
 *   - CONFIRM_STOP delegates directly to existing applyReplyStop() transaction
 *   - Input strictly validated
 *   - Returns clear JSON results
 */

import { NextRequest, NextResponse } from "next/server";
import { getPendingReviews, processOperatorReviewAction } from "@/lib/reply/review";
import type { OperatorReviewAction } from "@/lib/reply/review";

export async function GET() {
  try {
    const items = await getPendingReviews();
    return NextResponse.json({ reviews: items, count: items.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to load review queue";
    return NextResponse.json(
      { error: "Failed to load review queue.", detail: msg },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  let body: { reviewId?: unknown; action?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const { reviewId, action } = body;

  if (typeof reviewId !== "string" || !reviewId.trim()) {
    return NextResponse.json(
      { error: "Missing or invalid reviewId parameter." },
      { status: 400 }
    );
  }

  const VALID_ACTIONS: OperatorReviewAction[] = [
    "CONFIRM_STOP",
    "KEEP_ACTIVE",
    "DISMISS",
  ];

  if (typeof action !== "string" || !VALID_ACTIONS.includes(action as OperatorReviewAction)) {
    return NextResponse.json(
      {
        error: `Invalid action parameter. Must be one of: ${VALID_ACTIONS.join(", ")}.`,
      },
      { status: 400 }
    );
  }

  try {
    const result = await processOperatorReviewAction(
      reviewId,
      action as OperatorReviewAction
    );
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Review action failed";
    return NextResponse.json(
      { error: "Failed to process review action.", detail: msg },
      { status: 500 }
    );
  }
}

