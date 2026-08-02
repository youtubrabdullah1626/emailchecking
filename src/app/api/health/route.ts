export const dynamic = "force-dynamic";
/**
 * GET /api/health
 *
 * Unauthenticated liveness probe — used by cron services, uptime monitors,
 * and deployment pipelines to verify the application is alive.
 *
 * This endpoint MUST remain unauthenticated and lightweight.
 * It MUST NOT perform any database queries or external API calls.
 * It MUST respond in under 100ms under normal conditions.
 *
 * Response 200:
 *   { "status": "ok", "timestamp": "...", "version": "0.1.0" }
 *
 * Used by:
 *   - Vercel health checks
 *   - cron-job.org pre-flight checks
 *   - External uptime monitors (UptimeRobot, Betterstack, etc.)
 */

import { NextResponse } from "next/server";
import packageJson from "../../../../package.json";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: packageJson.version,
    environment: process.env.NODE_ENV ?? "unknown",
  });
}

