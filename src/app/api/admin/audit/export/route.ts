import { NextRequest, NextResponse } from "next/server";
import { auditService } from "@/lib/audit/audit.service";
import { getSessionUser } from "@/lib/audit/rbac";
import { rateLimiter } from "@/lib/audit/rate-limiter";
import { AuditLogFilters } from "@/lib/audit/audit.repository";
import { ExportService } from "@/lib/audit/export.service";

export async function GET(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") || req.ip || "127.0.0.1";
    
    // Stricter rate limit for exports
    const rateLimit = await rateLimiter.check(`audit_export_${ip}`, 10, 60000);
    if (!rateLimit.success) {
      return new NextResponse("Too Many Requests", { status: 429 });
    }

    const user = await getSessionUser();
    if (!user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const format = searchParams.get("format") || "csv";
    
    const filters: AuditLogFilters = {
      search: searchParams.get("q") || undefined,
      category: searchParams.get("category") || undefined,
      status: searchParams.get("status") || undefined,
      actorId: searchParams.get("actorId") || undefined,
      resourceId: searchParams.get("resourceId") || undefined,
    };

    // For exports, we might fetch a larger chunk or iterate cursors.
    // To protect memory, we limit export to the latest 5000 records.
    const { data: logs } = await auditService.fetchPaginatedLogs(user, filters, 5000);

    const exportService = new ExportService();
    
    if (format === "json") {
      const json = exportService.generateJSON(logs as any);
      return new NextResponse(json, {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="audit-export-${Date.now()}.json"`,
        },
      });
    } else {
      const csv = exportService.generateCSV(logs as any);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="audit-export-${Date.now()}.csv"`,
        },
      });
    }
  } catch (error: any) {
    console.error("[Audit Export API Error]", error);
    if (error.message === "FORBIDDEN" || error.message === "UNAUTHORIZED") {
      return new NextResponse("Forbidden", { status: 403 });
    }
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
