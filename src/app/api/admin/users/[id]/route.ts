import { NextRequest, NextResponse } from "next/server";
import { adminUsersService } from "@/lib/admin/users/users.service";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    if (!id) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    // Delegate to Service Layer
    const userProfile = await adminUsersService.getUserProfile(id);

    if (!userProfile) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ data: userProfile });
  } catch (error) {
    console.error(`[GET /api/admin/users/${params.id}] Error:`, error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = decodeURIComponent(params.id);
    const body = await request.json();
    const { daily_limit, hourly_limit } = body;

    // Delegate this to the service layer in the future, for now update DB directly 
    // to preserve legacy API contract from the old [email] route
    const updated = await prisma.emailAccount.update({
      where: { email: id },
      data: {
        daily_limit: Number(daily_limit),
        hourly_limit: Number(hourly_limit)
      }
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error(`[PATCH /api/admin/users/${params.id}] Error:`, error);
    return NextResponse.json({ error: "Failed to update limits" }, { status: 500 });
  }
}
