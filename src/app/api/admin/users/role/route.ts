import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { hasRole } from "@/lib/auth/roles";
import prisma from "@/lib/prisma";
import { auditService } from "@/lib/audit/audit.service";
import { UserRole } from "@/types/next-auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // STRICT RBAC: Only ADMIN or OWNER can assign roles.
    // ADMIN_VIEWER is explicitly blocked from executing write actions.
    if (!hasRole(session.user.role, "ADMIN")) {
      return NextResponse.json({ error: "Forbidden: You do not have permission to assign roles." }, { status: 403 });
    }

    const body = await request.json();
    const { email, role } = body;

    if (!email || !role) {
      return NextResponse.json({ error: "Email and role are required." }, { status: 400 });
    }

    const validRoles: UserRole[] = ["USER", "HELPER", "ADMIN_VIEWER", "ADMIN", "OWNER"];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: "Invalid role specified." }, { status: 400 });
    }

    // 1. Look up the user by email
    const targetUser = await prisma.users.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found with that email address." }, { status: 404 });
    }

    // 2. Prevent downgrading the OWNER (fail-safe)
    if (targetUser.role === "OWNER" && session.user.role !== "OWNER") {
      return NextResponse.json({ error: "Only the OWNER can modify the OWNER role." }, { status: 403 });
    }

    // 3. Securely update their role
    const updatedUser = await prisma.users.update({
      where: { id: targetUser.id },
      data: { role },
    });

    // 4. Log the audit event for security monitoring
    auditService.logAction(
      session.user.id,
      session.user.email || "system",
      "USER_ROLE_UPDATED",
      "SECURITY",
      `Assigned role ${role} to ${targetUser.email}`,
      "User",
      "SUCCESS",
      { resourceId: targetUser.id, newValues: { role } }
    );

    return NextResponse.json({ ok: true, user: { email: updatedUser.email, role: updatedUser.role } });

  } catch (error: any) {
    console.error("[API_ADMIN_ROLE_ASSIGN]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
