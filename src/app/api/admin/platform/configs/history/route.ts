/**
 * GET /api/admin/platform/configs/history?key=CONFIG_KEY
 */
import { NextRequest, NextResponse } from "next/server";
import { platformConfigService } from "@/lib/platform/platform-config.service";
import { getPlatformSessionUser } from "@/lib/platform/platform.rbac";

export async function GET(req: NextRequest) {
  try {
    const actor = await getPlatformSessionUser();
    if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const key = req.nextUrl.searchParams.get("key");
    const env = req.nextUrl.searchParams.get("environment") ?? "production";
    if (!key) return NextResponse.json({ error: "Missing required param: key" }, { status: 400 });

    const history = await platformConfigService.getConfigHistory(key, actor, env);
    return NextResponse.json({ data: history });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (err.message?.startsWith("FORBIDDEN")) return NextResponse.json({ error: err.message }, { status: 403 });
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
