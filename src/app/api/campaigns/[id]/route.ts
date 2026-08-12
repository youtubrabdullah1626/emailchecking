import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const campaign = await prisma.campaign.findUnique({
      where: { id: params.id },
      include: {
        prospects: {
          include: {
            sequences: {
              orderBy: { created_at: "desc" },
              take: 1,
              include: {
                steps: {
                  orderBy: { step_number: "asc" }
                }
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
