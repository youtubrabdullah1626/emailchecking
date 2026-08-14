import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const ratingFilter = searchParams.get("rating");
    const categoryFilter = searchParams.get("category");
    const statusFilter = searchParams.get("status");
    const search = searchParams.get("search")?.toLowerCase().trim();
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const skip = (page - 1) * limit;

    // 1. Fetch all feedbacks to compute overall CSAT metrics
    const allFeedbacks = await prisma.feedbacks.findMany({
      select: {
        id: true,
        rating: true,
        sentiment: true,
        category: true,
        status: true,
        created_at: true,
      },
    });

    const totalCount = allFeedbacks.length;
    const ratingSum = allFeedbacks.reduce((acc, f) => acc + f.rating, 0);
    const averageRating = totalCount > 0 ? parseFloat((ratingSum / totalCount).toFixed(2)) : 5.0;

    // Star Distribution
    const starDistribution = {
      5: allFeedbacks.filter((f) => f.rating === 5).length,
      4: allFeedbacks.filter((f) => f.rating === 4).length,
      3: allFeedbacks.filter((f) => f.rating === 3).length,
      2: allFeedbacks.filter((f) => f.rating === 2).length,
      1: allFeedbacks.filter((f) => f.rating === 1).length,
    };

    // Category Distribution
    const categoryDistribution: Record<string, number> = {};
    for (const f of allFeedbacks) {
      const cat = f.category || "GENERAL";
      categoryDistribution[cat] = (categoryDistribution[cat] || 0) + 1;
    }

    // Status counts
    const newCount = allFeedbacks.filter((f) => f.status === "NEW").length;
    const reviewedCount = allFeedbacks.filter((f) => f.status === "REVIEWED").length;
    const actionedCount = allFeedbacks.filter((f) => f.status === "ACTIONED").length;

    // Positive CSAT rate (4 & 5 stars)
    const positiveCount = starDistribution[5] + starDistribution[4];
    const csatPercentage = totalCount > 0 ? Math.round((positiveCount / totalCount) * 100) : 100;

    // 2. Build filtered query for table list
    const where: any = {};

    if (ratingFilter && ratingFilter !== "ALL") {
      where.rating = parseInt(ratingFilter, 10);
    }

    if (categoryFilter && categoryFilter !== "ALL") {
      where.category = categoryFilter;
    }

    if (statusFilter && statusFilter !== "ALL") {
      where.status = statusFilter;
    }

    if (search) {
      where.OR = [
        { comment: { contains: search, mode: "insensitive" } },
        { users: { email: { contains: search, mode: "insensitive" } } },
        { users: { name: { contains: search, mode: "insensitive" } } },
      ];
    }

    const [filteredFeedbacks, filteredCount] = await Promise.all([
      prisma.feedbacks.findMany({
        where,
        include: {
          users: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
              timezone: true,
              createdAt: true,
            },
          },
        },
        orderBy: { created_at: "desc" },
        skip,
        take: limit,
      }),
      prisma.feedbacks.count({ where }),
    ]);

    return NextResponse.json({
      metrics: {
        totalFeedbacks: totalCount,
        averageRating,
        csatPercentage,
        newCount,
        reviewedCount,
        actionedCount,
        starDistribution,
        categoryDistribution,
      },
      feedbacks: filteredFeedbacks,
      pagination: {
        total: filteredCount,
        page,
        limit,
        totalPages: Math.ceil(filteredCount / limit),
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to load admin feedback analytics";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
