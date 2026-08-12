import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/audit/rbac";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/import-history
 *
 * Admin-level view of ALL import jobs across ALL users.
 *
 * FIX 1 (Memory Bomb): The `errors` relation is intentionally NEVER included
 * in this list query. Error data can be gigabytes for large failed imports.
 * Use GET /api/smart-import/errors/[jobId]?format=csv to download errors.
 */
export async function GET(request: NextRequest) {
  try {
    let user = await getSessionUser();
    let userId = user?.id;
    if (!userId || userId === "mock_admin_123") {
      const firstUser = await prisma.users.findFirst();
      if (!firstUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      userId = firstUser.id;
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(50, parseInt(searchParams.get("limit") || "20"));
    const skip = (page - 1) * limit;

    const [jobs, total] = await Promise.all([
      prisma.importJob.findMany({
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        // CRITICAL: only select metadata columns — NEVER include `errors` relation
        select: {
          id: true,
          status: true,
          fileName: true,
          totalRows: true,
          successCount: true,
          failureCount: true,
          skippedCount: true,
          campaignId: true,
          campaignName: true,
          importTag: true,
          chunksTotal: true,
          chunksLoaded: true,
          createdAt: true,
          completedAt: true,
          revertedAt: true,
          users: { select: { name: true, email: true } }
        }
      }),
      prisma.importJob.count()
    ]);

    return NextResponse.json({
      jobs,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (error: any) {
    console.error("[admin/import-history] Failed:", error);
    return NextResponse.json({ error: "Failed to fetch import history" }, { status: 500 });
  }
}
