/**
 * POST /api/admin/platform/rollback
 * Body: { domain: "flag" | "config" | "provider", historyId: string }
 * Restores a previous configuration version. Creates a new history record.
 */

import { NextRequest, NextResponse } from "next/server";
import { featureFlagService } from "@/lib/platform/feature-flag.service";
import { platformConfigService } from "@/lib/platform/platform-config.service";
import { providerRoutingService } from "@/lib/platform/provider-routing.service";
import { getPlatformSessionUser } from "@/lib/platform/platform.rbac";

export async function POST(req: NextRequest) {
  try {
    const actor = await getPlatformSessionUser();
    if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { domain, historyId } = body;

    if (!domain || !historyId) {
      return NextResponse.json({ error: "Missing required fields: domain, historyId" }, { status: 400 });
    }

    let result;
    switch (domain) {
      case "flag":
        result = await featureFlagService.rollbackFlag(historyId, actor);
        break;
      case "config":
        result = await platformConfigService.rollbackConfig(historyId, actor);
        break;
      case "provider":
        result = await providerRoutingService.rollbackProvider(historyId, actor);
        break;
      default:
        return NextResponse.json({ error: `Unknown domain '${domain}'. Use: flag, config, provider` }, { status: 400 });
    }

    return NextResponse.json({ data: result, message: "Rollback completed successfully" });
  } catch (err: any) {
    console.error("[Platform Rollback POST]", err);
    if (err.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (err.message?.startsWith("FORBIDDEN")) return NextResponse.json({ error: err.message }, { status: 403 });
    if (err.message?.includes("not found")) return NextResponse.json({ error: err.message }, { status: 404 });
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
