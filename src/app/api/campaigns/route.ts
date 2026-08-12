import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const campaigns = await prisma.campaign.findMany({
      orderBy: { created_at: "desc" },
      include: {
        _count: {
          select: { prospects: true }
        }
      }
    });

    return NextResponse.json({ ok: true, data: campaigns });
  } catch (error: any) {
    console.error("Failed to fetch campaigns", error);
    return NextResponse.json({ ok: false, error: "Failed to load campaigns" }, { status: 500 });
  }
}
