import { NextRequest, NextResponse } from "next/server";
import { adminUsersService } from "@/lib/admin/users/users.service";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const type = body.type as "temporary" | "permanent";
    
    // In a real app, adminId would come from session context
    const adminId = "admin-session-id"; 

    if (!type || !["temporary", "permanent"].includes(type)) {
      return NextResponse.json({ error: "Invalid block type" }, { status: 400 });
    }

    await adminUsersService.blockUser(params.id, adminId, type);
    
    return NextResponse.json({ success: true, message: `User blocked (${type}) successfully` });
  } catch (error: any) {
    console.error(`[POST /api/admin/users/${params.id}/block] Error:`, error);
    return NextResponse.json(
      { error: "Failed to block user", details: error.message },
      { status: 500 }
    );
  }
}
