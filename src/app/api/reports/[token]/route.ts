import { NextRequest, NextResponse } from "next/server";
import { verifyReportToken } from "@/lib/reports/token";
import { getCampaignReportData } from "@/lib/reports/aggregator";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> | { token: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const token = resolvedParams?.token;

    if (!token) {
      return NextResponse.json({ error: "Missing report token." }, { status: 400 });
    }

    const verification = verifyReportToken(token);
    if (!verification.valid || !verification.campaignId) {
      return NextResponse.json(
        { error: "Invalid or expired report link." },
        { status: 404 }
      );
    }

    const reportData = await getCampaignReportData(verification.campaignId, token);
    if (!reportData) {
      return NextResponse.json(
        { error: "Campaign not found or has been archived." },
        { status: 404 }
      );
    }

    return NextResponse.json(reportData, {
      status: 200,
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120",
      },
    });
  } catch (error) {
    console.error("[GET /api/reports/[token]] Error:", error);
    return NextResponse.json(
      { error: "Internal server error fetching report." },
      { status: 500 }
    );
  }
}
