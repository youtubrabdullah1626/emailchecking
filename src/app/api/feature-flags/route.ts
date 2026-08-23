/**
 * GET /api/feature-flags?keys=campaign_pause_resume,some_other_flag
 *
 * Public (non-admin) endpoint — any authenticated user can read feature flag values.
 * Returns a plain key→boolean map so the frontend can gate UI elements.
 *
 * ⚡ DEEP-LEVEL FIX: Always reads directly from DB — no in-memory cache.
 * This guarantees that when an admin toggles a flag in Platform Config,
 * every user sees the change on their next SWR revalidation (≤30s).
 * The in-memory cache is NOT used here because it is per-server-instance
 * and unreliable on Railway multi-dyno deployments.
 *
 * Example response: { "campaign_pause_resume": true }
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import prisma from "@/lib/prisma";

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

    // ── Direct DB read — guaranteed to reflect the latest toggle ──────────
    // Single query fetches all requested flags at once (indexed by key).
    const rows = await prisma.feature_flags.findMany({
      where: {
        key: { in: requestedKeys },
        environment: "production",
      },
      select: { key: true, enabled: true },
    });

    // Build key→boolean map. Any key not found in DB defaults to true
    // (fail-open: if the flag row doesn't exist yet, the feature stays ON).
    const result: Record<string, boolean> = {};
    for (const key of requestedKeys) {
      const row = rows.find((r) => r.key === key);
      result[key] = row ? row.enabled : true;
    }

    return NextResponse.json(result, {
      status: 200,
      headers: {
        // No CDN caching — always fresh. Browser may cache for max 5s only.
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err: any) {
    console.error("[feature-flags GET]", err);
    // Fail open — if DB is down, return true (features stay enabled)
    return NextResponse.json(
      Object.fromEntries(
        (req.nextUrl.searchParams.get("keys") ?? "")
          .split(",")
          .filter(Boolean)
          .map((k) => [k.trim(), true])
      ),
      { status: 200 }
    );
  }
}
