import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { dispatchAlert } from "@/lib/intelligence/alerts";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await req.json();
    const { rating, category, comment, pageUrl } = body;

    // 1. Validate rating
    const numRating = parseInt(String(rating), 10);
    if (isNaN(numRating) || numRating < 1 || numRating > 5) {
      return NextResponse.json(
        { error: "Rating must be an integer between 1 and 5." },
        { status: 400 }
      );
    }

    // 2. Anti-spam rate limiting: Max 3 feedbacks per user per 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentFeedbackCount = await prisma.feedbacks.count({
      where: {
        user_id: userId,
        created_at: { gte: twentyFourHoursAgo },
      },
    });

    if (recentFeedbackCount >= 3) {
      return NextResponse.json(
        { error: "You have reached the maximum feedback submissions for today (3). Thank you for your input!" },
        { status: 429 }
      );
    }

    // 3. Derive Sentiment
    let sentiment = "EXCELLENT";
    if (numRating === 4) sentiment = "GOOD";
    else if (numRating === 3) sentiment = "AVERAGE";
    else if (numRating <= 2) sentiment = "POOR";

    // 4. Sanitize category & comment
    const sanitizedCategory = typeof category === "string" ? category.trim().toUpperCase().slice(0, 50) : "GENERAL";
    const sanitizedComment = typeof comment === "string" ? comment.trim().slice(0, 1500) : null;
    const sanitizedPageUrl = typeof pageUrl === "string" ? pageUrl.trim().slice(0, 255) : null;

    // 5. Store in Database
    const feedback = await prisma.feedbacks.create({
      data: {
        user_id: userId,
        rating: numRating,
        sentiment,
        category: sanitizedCategory,
        comment: sanitizedComment,
        page_url: sanitizedPageUrl,
        status: "NEW",
      },
    });

    // 6. Proactive Low-Rating Dispatch Alert
    if (numRating <= 2) {
      dispatchAlert({
        title: "Critical Feedback Received",
        description: `User gave a ${numRating}-star rating (${sanitizedCategory}): "${sanitizedComment || 'No comment provided'}". Review in Admin CSAT Hub.`,
        severity: "HIGH",
        service: "feedback",
      }).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      message: "Thank you for your feedback! It has been shared directly with our founding team.",
      feedbackId: feedback.id,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to submit feedback";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const latestFeedback = await prisma.feedbacks.findFirst({
      where: { user_id: userId },
      orderBy: { created_at: "desc" },
      select: { created_at: true, rating: true },
    });

    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const canPromptMilestone = !latestFeedback || (now - new Date(latestFeedback.created_at).getTime() >= THIRTY_DAYS_MS);

    return NextResponse.json({
      lastFeedbackAt: latestFeedback?.created_at?.toISOString() || null,
      lastRating: latestFeedback?.rating || null,
      canPromptMilestone,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch feedback status";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
