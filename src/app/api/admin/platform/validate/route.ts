/**
 * POST /api/admin/platform/validate
 * Validates a config/provider value without persisting. For real-time UI feedback.
 */

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { configValidationService } from "@/lib/platform/config-validation.service";
import { getPlatformSessionUser } from "@/lib/platform/platform.rbac";
import { PlatformConfigRepository } from "@/lib/platform/platform-config.repository";

const configRepo = new PlatformConfigRepository();

export async function POST(req: NextRequest) {
  try {
    const actor = await getPlatformSessionUser();
    if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { domain, key, value, allowedValues } = body;

    if (!domain || !key || value === undefined) {
      return NextResponse.json({ error: "Missing required fields: domain, key, value" }, { status: 400 });
    }

    let result;

    if (domain === "config") {
      const config = await configRepo.findByKey(key);
      if (!config) return NextResponse.json({ error: `Config '${key}' not found` }, { status: 404 });
      result = configValidationService.validateConfigValue(config, value);
    } else if (domain === "provider") {
      if (!Array.isArray(allowedValues)) {
        return NextResponse.json({ error: "allowedValues is required for provider domain" }, { status: 400 });
      }
      result = configValidationService.validateProviderValue(allowedValues, value);
    } else {
      return NextResponse.json({ error: `Unknown domain '${domain}'. Use: config, provider` }, { status: 400 });
    }

    return NextResponse.json({ valid: result.valid, errors: result.errors });
  } catch (err: any) {
    console.error("[Platform Validate POST]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
