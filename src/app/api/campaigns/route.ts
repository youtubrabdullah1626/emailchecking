import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const campaigns = await prisma.campaign.findMany({
      where: { user_id: session.user.id },
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
