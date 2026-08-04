import { NextRequest, NextResponse } from "next/server";
import { adminUsersService } from "@/lib/admin/users/users.service";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // In a real app, adminId would come from session context
    const adminId = "admin-session-id"; 

    await adminUsersService.unblockUser(params.id, adminId);
    
    return NextResponse.json({ success: true, message: "User unblocked successfully" });
  } catch (error: any) {
    console.error(`[POST /api/admin/users/${params.id}/unblock] Error:`, error);
    return NextResponse.json(
      { error: "Failed to unblock user", details: error.message },
      { status: 500 }
    );
  }
}
