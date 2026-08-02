import { NextResponse } from "next/server";
import { getSystemHealth } from "@/lib/health/system";
import { getDatabaseHealth } from "@/lib/health/database";
import { getGmailHealth } from "@/lib/health/gmail";
import { getAIHealth } from "@/lib/health/ai";
import { getSchedulerHealth } from "@/lib/health/scheduler";

export const dynamic = "force-dynamic";

export async function GET() {
  const start = performance.now();
  
  const [sys, db, gmail, scheduler, ai] = await Promise.all([
    getSystemHealth(),
    getDatabaseHealth(),
    getGmailHealth(),
    getSchedulerHealth(),
    getAIHealth(),
  ]);
  
  sys.responseLatencyMs = Math.round(performance.now() - start);

  return NextResponse.json({
    system: sys,
    database: db,
    gmail,
    scheduler,
    ai,
    timestamp: new Date().toISOString()
  });
}
