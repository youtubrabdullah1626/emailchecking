import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/audit/rbac";

export const dynamic = "force-dynamic";

/**
 * POST /api/smart-import/create-job
 * Phase 1: Initializes an import session in the DB and returns a jobId + campaignId.
 * The frontend calls this ONCE before chunked uploads begin.
 */
export async function POST(request: NextRequest) {
  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const user = await getSessionUser();
    const userId = user?.id;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { fileName, totalRows, campaignName, chunksTotal, importTag } = body;

    const safeFileName = fileName || "import-prospects.pdf";
    const safeTotalRows = Math.max(1, Number(totalRows) || 1);
    const safeChunksTotal = Math.max(1, Number(chunksTotal) || 1);

    if (safeChunksTotal > 100) {
      return NextResponse.json({ error: "Import too large. Maximum 50,000 rows per session." }, { status: 400 });
    }

    // ── Create Campaign First ─────────────────────────────────────────────────
    const campaign = await prisma.campaign.create({
      data: {
        name: campaignName || `Bulk Import — ${new Date().toLocaleDateString()}`,
        status: "ACTIVE",
        user_id: userId,
      }
    });

    // ── Create Import Job Record ──────────────────────────────────────────────
    const job = await prisma.importJob.create({
      data: {
        userId,
        status: "PROCESSING",
        fileName: safeFileName,
        totalRows: safeTotalRows,
        campaignId: campaign.id,
        campaignName: campaign.name,
        importTag: importTag || null,
        chunksTotal: safeChunksTotal,
        chunksLoaded: 0,
      }
    });

    return NextResponse.json({
      ok: true,
      jobId: job.id,
      campaignId: campaign.id,
    });

  } catch (error: any) {
    console.error("[create-job] Failed:", error);
    return NextResponse.json({ error: error.message || "Failed to create import job" }, { status: 500 });
  }
}
