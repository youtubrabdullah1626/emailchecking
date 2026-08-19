/**
 * GET  /api/admin/platform/flags   — List all feature flags (admin read)
 * PATCH /api/admin/platform/flags  — Toggle a feature flag
 */

import { NextRequest, NextResponse } from "next/server";
import { featureFlagService } from "@/lib/platform/feature-flag.service";
import { getPlatformSessionUser } from "@/lib/platform/platform.rbac";
import { ensurePageLockFlags } from "@/lib/platform/page-lock";

export async function GET(req: NextRequest) {
  try {
    const actor = await getPlatformSessionUser();
    if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Auto-ensure lockable module flags exist in the database
    await ensurePageLockFlags();

    const searchParams = req.nextUrl.searchParams;
    const params = {
      environment: searchParams.get("environment") ?? "production",
      search: searchParams.get("search") ?? undefined,
      category: searchParams.get("category") ?? undefined,
      status: (searchParams.get("status") as any) ?? undefined,
      risk_level: searchParams.get("risk_level") ?? undefined,
      cursor: searchParams.get("cursor") ?? undefined,
      limit: searchParams.has("limit") ? parseInt(searchParams.get("limit")!, 10) : undefined,
    };

    const result = await featureFlagService.getAllFlags(actor, params);
    return NextResponse.json({ data: result });
  } catch (err: any) {
    console.error("[Platform Flags GET]", err);
    if (err.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (err.message?.startsWith("FORBIDDEN")) return NextResponse.json({ error: err.message }, { status: 403 });
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const actor = await getPlatformSessionUser();
    if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { key, enabled, reason, environment = "production" } = body;

    if (!key || typeof enabled !== "boolean") {
      return NextResponse.json({ error: "Missing required fields: key (string), enabled (boolean)" }, { status: 400 });
    }

    const updated = await featureFlagService.toggleFlag(key, enabled, actor, reason, environment);
    return NextResponse.json({ data: updated });
  } catch (err: any) {
    console.error("[Platform Flags PATCH]", err);
    if (err.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (err.message?.startsWith("FORBIDDEN")) return NextResponse.json({ error: err.message }, { status: 403 });
    return NextResponse.json({ error: err.message || "Failed to toggle flag" }, { status: 400 });
  }
}
