import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/audit/rbac";

export const dynamic = "force-dynamic";

/**
 * GET /api/smart-import/job-status/[jobId]
 * Returns live progress of an import job. Never includes error rows (too large).
 * Errors are fetched separately via /api/smart-import/errors/[jobId]
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

    const job = await prisma.importJob.findFirst({
      where: { id: params.jobId, userId },
      select: {
        id: true,
        status: true,
        fileName: true,
        totalRows: true,
        successCount: true,
        failureCount: true,
        skippedCount: true,
        chunksTotal: true,
        chunksLoaded: true,
        campaignId: true,
        campaignName: true,
        createdAt: true,
        completedAt: true,
        revertedAt: true,
        // NOTE: errors relation is intentionally excluded from this endpoint
        // Use GET /api/smart-import/errors/[jobId] for downloading errors
      }
    });

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const progressPercent = job.chunksTotal > 0
      ? Math.min(100, Math.round((job.chunksLoaded / job.chunksTotal) * 100))
      : 0;

    return NextResponse.json({ job, progressPercent });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to fetch job status" }, { status: 500 });
  }
}

/**
 * PATCH /api/smart-import/job-status/[jobId]
 * Abort an in-progress import.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const user = await getSessionUser();
    const userId = user?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const job = await prisma.importJob.findFirst({
      where: { id: params.jobId, userId },
      select: { id: true }
    });
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    const updated = await prisma.importJob.update({
      where: { id: params.jobId },
      data: { status: "ABORTED", completedAt: new Date() }
    });

    return NextResponse.json({ ok: true, status: updated.status });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to abort job" }, { status: 500 });
  }
}
