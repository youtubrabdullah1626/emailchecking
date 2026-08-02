import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const skip = (page - 1) * limit;

    const [total, errors] = await prisma.$transaction([
      prisma.systemError.count(),
      prisma.systemError.findMany({
        orderBy: { lastSeen: "desc" },
        skip,
        take: limit,
      })
    ]);

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      data: errors,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch system errors" },
      { status: 500 }
    );
  }
}
