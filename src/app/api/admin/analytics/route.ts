import { NextResponse } from "next/server";
import { AnalyticsService } from "@/lib/analytics/analytics.service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    // In a full production environment, verify the user's admin role here using next-auth
    // const session = await getServerSession(authOptions);
    // if (!session || session.user.role !== 'ADMIN') return new NextResponse("Unauthorized", { status: 401 });

    const analyticsService = new AnalyticsService();
    const payload = await analyticsService.getGlobalDashboardMetrics();

    return NextResponse.json(payload, {
      status: 200,
      headers: {
        'Cache-Control': 's-maxage=30, stale-while-revalidate=59',
      }
    });
  } catch (error) {
    console.error("[API_ADMIN_ANALYTICS] Internal server error:", error);
    // Never leak stack traces. Standardized error response.
    return NextResponse.json(
      { error: "An unexpected error occurred while fetching analytics." },
      { status: 500 }
    );
  }
}
