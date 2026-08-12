/**
 * GET  /api/admin/platform/providers    — List all provider configs
 * PATCH /api/admin/platform/providers   — Update active provider
 */

import { NextRequest, NextResponse } from "next/server";
import { providerRoutingService } from "@/lib/platform/provider-routing.service";
import { getPlatformSessionUser } from "@/lib/platform/platform.rbac";

export async function GET(req: NextRequest) {
  try {
    const actor = await getPlatformSessionUser();
    if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const searchParams = req.nextUrl.searchParams;
    const params = {
      environment: searchParams.get("environment") ?? "production",
      search: searchParams.get("search") ?? undefined,
      cursor: searchParams.get("cursor") ?? undefined,
      limit: searchParams.has("limit") ? parseInt(searchParams.get("limit")!, 10) : undefined,
    };

    const result = await providerRoutingService.getAllProviders(actor, params);
    return NextResponse.json({ data: result });
  } catch (err: any) {
    console.error("[Platform Providers GET]", err);
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
    const { key, activeProvider, reason, environment = "production" } = body;

    if (!key || !activeProvider) {
      return NextResponse.json({ error: "Missing required fields: key, activeProvider" }, { status: 400 });
    }

    const updated = await providerRoutingService.updateProvider(
      key, activeProvider, actor, reason, environment
    );
    return NextResponse.json({ data: updated });
  } catch (err: any) {
    console.error("[Platform Providers PATCH]", err);
    if (err.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (err.message?.startsWith("FORBIDDEN")) return NextResponse.json({ error: err.message }, { status: 403 });
    if (err.message?.includes("Validation") || err.message?.includes("not found")) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
