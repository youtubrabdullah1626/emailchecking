import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // user_id in WHERE prevents IDOR — user can only read their own campaigns
    const campaign = await prisma.campaign.findUnique({
      where: { id: params.id, user_id: session.user.id },
      include: {
        prospects: {
          include: {
            sequences: {
              orderBy: { created_at: "desc" },
              take: 1,
              include: {
                steps: { orderBy: { step_number: "asc" } }
              }
            }
          },
          orderBy: { created_at: "desc" }
        }
      }
    });

    if (!campaign) {
      return NextResponse.json({ ok: false, error: "Campaign not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, data: campaign });
  } catch (error: any) {
    console.error("Failed to fetch campaign details", error);
    return NextResponse.json({ ok: false, error: "Failed to load campaign" }, { status: 500 });
  }
}
