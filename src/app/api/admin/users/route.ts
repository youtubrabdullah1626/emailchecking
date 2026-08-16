import { NextRequest, NextResponse } from "next/server";
import { adminUsersService } from "@/lib/admin/users/users.service";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    // ── 1. Real Authorization — require ADMIN or above
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { isOwnerEmail } = await import("@/lib/auth/roles");
    const role = session.user.role;
    const isOwner = isOwnerEmail(session.user.email);
    if (!isOwner && role !== "SUPER_ADMIN" && role !== "OWNER" && role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // ── 2. Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search") || undefined;
    const plan = searchParams.get("plan") || undefined;
    const status = searchParams.get("status") || undefined;
    const role_filter = searchParams.get("role") || undefined;
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    // ── 3. Delegate to Service Layer
    const result = await adminUsersService.getPaginatedUsers({
      search,
      plan,
      status,
      role: role_filter,
      limit,
      offset,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[GET /api/admin/users] Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
