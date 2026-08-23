/**
 * GET /api/feature-flags?keys=campaign_pause_resume,some_other_flag
 *
 * Public (non-admin) endpoint — any authenticated user can read feature flag values.
 * Returns a plain key→boolean map so the frontend can gate UI elements.
 *
 * Example response: { "campaign_pause_resume": true }
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { featureFlagService } from "@/lib/platform/feature-flag.service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const keysParam = req.nextUrl.searchParams.get("keys") ?? "";
    const requestedKeys = keysParam
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);

    if (requestedKeys.length === 0) {
      return NextResponse.json({}, { status: 200 });
    }

    // Cache-first reads — ~0ms, no DB call when cache is warm
    const result: Record<string, boolean> = {};
    for (const key of requestedKeys) {
      result[key] = featureFlagService.isEnabled(key);
    }

    return NextResponse.json(result, {
      status: 200,
      headers: {
        // Cache for 60s on the CDN/edge; client re-validates every 60s
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (err: any) {
    console.error("[feature-flags GET]", err);
    // Fail open — if flag service is down, return true (features stay enabled)
    return NextResponse.json({}, { status: 200 });
  }
}
