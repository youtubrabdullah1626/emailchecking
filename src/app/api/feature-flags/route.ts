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
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const keysParam = req.nextUrl.searchParams.get("keys") ?? "";
    const requestedKeys = keysParam
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);

    if (requestedKeys.length === 0) {
      return NextResponse.json({}, { status: 200 });
    }

    // Direct DB query across all matching keys without environment restriction
    const rows = await prisma.feature_flags.findMany({
      where: {
        key: { in: requestedKeys },
      },
      select: { key: true, enabled: true },
    });

    const result: Record<string, boolean> = {};
    for (const key of requestedKeys) {
      const row = rows.find((r) => r.key === key);
      // If row found, use its enabled value. If not found in DB, default to true.
      result[key] = row ? Boolean(row.enabled) : true;
    }

    return NextResponse.json(result, {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    });
  } catch (err: any) {
    console.error("[feature-flags GET] Error:", err);
    return NextResponse.json({}, { status: 200 });
  }
}

