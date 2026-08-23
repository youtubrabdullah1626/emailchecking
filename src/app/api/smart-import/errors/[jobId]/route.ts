import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/audit/rbac";

export const dynamic = "force-dynamic";

/**
 * GET /api/smart-import/errors/[jobId]
 *
 * Dedicated endpoint for fetching import errors — completely separate from the
 * job status/list endpoints so error data never pollutes normal queries.
 *
 * Supports two modes via ?format= query param:
 *   - "json" (default): Paginated JSON for UI display
 *   - "csv": Streams a downloadable CSV file — used by the "Download Error Report" button
 *
 * This solves the memory bomb: errors are fetched ONLY when explicitly requested,
 * paginated at 500 rows, and never loaded during list/dashboard queries.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const user = await getSessionUser();
    const userId = user?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify ownership (admin can see all — check if job exists at all for admin)
    const job = await prisma.importJob.findFirst({
      where: { id: params.jobId },
      select: {
        id: true,
        userId: true,
        fileName: true,
        failureCount: true,
      }
    });

    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    // Non-admin users can only see their own jobs
    const userRecord = await prisma.users.findFirst({ where: { id: userId }, select: { role: true } });
    const isAdmin = userRecord?.role === "ADMIN" || userRecord?.role === "admin";
    if (!isAdmin && job.userId !== userId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "json";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = 500; // Fixed — large enough for CSV, safe for memory
    const skip = (page - 1) * limit;

    // Paginated error fetch — never loads all errors into memory at once
    const errors = await prisma.importError.findMany({
      where: { jobId: params.jobId },
      orderBy: { rowIndex: "asc" },
      skip,
      take: limit,
      select: { id: true, email: true, rowIndex: true, reason: true, createdAt: true }
    });

    // ── CSV Mode: streams a downloadable file ─────────────────────────────────
    if (format === "csv") {
      const header = "Row Index,Email,Reason\n";
      const rows = errors
        .map(e => `${e.rowIndex ?? ""},"${(e.email || "").replace(/"/g, '""')}","${(e.reason || "").replace(/"/g, '""')}"`)
        .join("\n");

      const csvContent = header + rows;
      const safeFileName = (job.fileName || "import").replace(/[^a-z0-9]/gi, "_");

      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="errors-${safeFileName}-${params.jobId.slice(0, 8)}.csv"`,
          "Cache-Control": "no-store",
        }
      });
    }

    // ── JSON Mode ─────────────────────────────────────────────────────────────
    return NextResponse.json({
      errors,
      total: job.failureCount,
      page,
      hasMore: skip + errors.length < job.failureCount
    });

  } catch (error: any) {
    console.error("[errors/jobId] Failed:", error);
    return NextResponse.json({ error: "Failed to fetch errors" }, { status: 500 });
  }
}
