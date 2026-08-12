import { NextRequest, NextResponse } from "next/server";
import { auditService } from "@/lib/audit/audit.service";
import { getSessionUser } from "@/lib/audit/rbac";
import { rateLimiter } from "@/lib/audit/rate-limiter";
import { AuditLogFilters } from "@/lib/audit/audit.repository";

export async function GET(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") || req.ip || "127.0.0.1";
    
    // 1. Rate Limiting (e.g. 100 requests per 10 seconds)
    const rateLimit = await rateLimiter.check(`audit_get_${ip}`, 100, 10000);
    if (!rateLimit.success) {
      return NextResponse.json({ error: "Too Many Requests" }, { status: 429 });
    }

    // 2. Resolve User Session
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 3. Parse Parameters
    const searchParams = req.nextUrl.searchParams;
    const filters: AuditLogFilters = {
      search: searchParams.get("q") || undefined,
      category: searchParams.get("category") || undefined,
      status: searchParams.get("status") || undefined,
      severity: searchParams.get("severity") || undefined,
      time: searchParams.get("time") || undefined,
      actorId: searchParams.get("actorId") || undefined,
      resourceId: searchParams.get("resourceId") || undefined,
    };

    const cursor = searchParams.get("cursor") || undefined;
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    // 4. Delegate to Service Layer
    const result = await auditService.fetchPaginatedLogs(user, filters, limit, cursor);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[Audit API Error]", error);
    if (error.message === "FORBIDDEN" || error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { olderThanOneMonth } = await req.json().catch(() => ({}));

    let olderThanDate = undefined;
    if (olderThanOneMonth) {
      olderThanDate = new Date();
      olderThanDate.setMonth(olderThanDate.getMonth() - 1);
    }
    
    console.log("[Audit DELETE] olderThanOneMonth:", olderThanOneMonth, "olderThanDate:", olderThanDate);

    const count = await auditService.clearOldLogs(user, olderThanDate);
    console.log("[Audit DELETE] deleted count:", count);

    return NextResponse.json({ success: true, count });
  } catch (error: any) {
    console.error("[Audit API Delete Error]", error);
    if (error.message === "FORBIDDEN" || error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
