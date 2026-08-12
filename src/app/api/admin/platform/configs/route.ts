/**
 * GET  /api/admin/platform/configs      — List all platform configs
 * PATCH /api/admin/platform/configs     — Update a config value
 */

import { NextRequest, NextResponse } from "next/server";
import { platformConfigService } from "@/lib/platform/platform-config.service";
import { getPlatformSessionUser } from "@/lib/platform/platform.rbac";

export async function GET(req: NextRequest) {
  try {
    const actor = await getPlatformSessionUser();
    if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const searchParams = req.nextUrl.searchParams;
    const params = {
      environment: searchParams.get("environment") ?? "production",
      search: searchParams.get("search") ?? undefined,
      category: searchParams.get("category") ?? undefined,
      risk_level: searchParams.get("risk_level") ?? undefined,
      cursor: searchParams.get("cursor") ?? undefined,
      limit: searchParams.has("limit") ? parseInt(searchParams.get("limit")!, 10) : undefined,
    };

    const result = await platformConfigService.getAllConfigs(actor, params);
    return NextResponse.json({ data: result });
  } catch (err: any) {
    console.error("[Platform Configs GET]", err);
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
    const { key, value, reason, environment = "production" } = body;

    if (!key || value === undefined) {
      return NextResponse.json({ error: "Missing required fields: key, value" }, { status: 400 });
    }

    const updated = await platformConfigService.updateConfig(key, value, actor, reason, environment);
    return NextResponse.json({ data: updated });
  } catch (err: any) {
    console.error("[Platform Configs PATCH]", err);
    if (err.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (err.message?.startsWith("FORBIDDEN")) return NextResponse.json({ error: err.message }, { status: 403 });
    if (err.message?.includes("Validation") || err.message?.includes("not found")) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
