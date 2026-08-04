import { NextRequest, NextResponse } from "next/server";
import { adminUsersService } from "@/lib/admin/users/users.service";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    // 1. Authorization Verification (Simulated for this milestone)
    const cookieStore = cookies();
    // if (!cookieStore.get("admin_session")) {
    //   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    // }

    // 2. Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search") || undefined;
    const plan = searchParams.get("plan") || undefined;
    const status = searchParams.get("status") || undefined;
    const role = searchParams.get("role") || undefined;
    
    const limitParam = searchParams.get("limit");
    const offsetParam = searchParams.get("offset");
    
    const limit = limitParam ? parseInt(limitParam, 10) : 50;
    const offset = offsetParam ? parseInt(offsetParam, 10) : 0;

    // 3. Delegate to Service Layer
    const result = await adminUsersService.getPaginatedUsers({
      search,
      plan,
      status,
      role,
      limit,
      offset,
    });

    // 4. Return sanitized response
    return NextResponse.json(result);
  } catch (error) {
    console.error("[GET /api/admin/users] Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
