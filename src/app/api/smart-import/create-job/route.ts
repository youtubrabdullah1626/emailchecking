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
    let user = await getSessionUser();
    let userId = user?.id;

    if (!userId || userId === "mock_admin_123") {
      const firstUser = await prisma.users.findFirst();
      if (!firstUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      userId = firstUser.id;
    }

    const body = await request.json();
    const { fileName, totalRows, campaignName, chunksTotal, importTag } = body;

    if (!fileName || !totalRows || !chunksTotal) {
      return NextResponse.json({ error: "Missing required fields: fileName, totalRows, chunksTotal" }, { status: 400 });
    }

    if (chunksTotal > 100) {
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
        fileName,
        totalRows: Number(totalRows),
        campaignId: campaign.id,
        campaignName: campaign.name,
        importTag: importTag || null,
        chunksTotal: Number(chunksTotal),
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
