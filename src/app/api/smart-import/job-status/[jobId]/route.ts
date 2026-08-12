import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/audit/rbac";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    let user = await getSessionUser();
    let userId = user?.id;
    if (!userId || userId === "mock_admin_123") {
      const firstUser = await prisma.users.findFirst();
      if (!firstUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      userId = firstUser.id;
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
      }
    });

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const progressPercent = job.chunksTotal > 0
      ? Math.round((job.chunksLoaded / job.chunksTotal) * 100)
      : 0;

    return NextResponse.json({ job, progressPercent });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to fetch job status" }, { status: 500 });
  }
}

/**
 * PATCH /api/smart-import/job-status/[jobId]
 * Abort an in-progress import (e.g., user clicked "Cancel").
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    let user = await getSessionUser();
    let userId = user?.id;
    if (!userId || userId === "mock_admin_123") {
      const firstUser = await prisma.users.findFirst();
      if (!firstUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      userId = firstUser.id;
    }

    const job = await prisma.importJob.findFirst({ where: { id: params.jobId, userId } });
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    const updated = await prisma.importJob.update({
      where: { id: params.jobId },
      data: { status: "ABORTED", completedAt: new Date() }
    });

    return NextResponse.json({ ok: true, job: updated });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to abort job" }, { status: 500 });
  }
}
