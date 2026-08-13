/**
 * Enterprise Role-Based Access Control (RBAC)
 *
 * Wire to real NextAuth session — no more mocks.
 * Roles: SUPER_ADMIN > OWNER > ADMIN > USER
 */

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/nextauth";

export type UserRole = "SUPER_ADMIN" | "OWNER" | "ADMIN" | "USER";

export interface SessionUser {
  id: string;
  email: string;
  role: UserRole;
  isSuspended?: boolean;
}

export function requireAdminRole(user: SessionUser | null | undefined): void {
  if (!user) throw new Error("UNAUTHORIZED");
  if (user.role !== "SUPER_ADMIN" && user.role !== "OWNER" && user.role !== "ADMIN") {
    throw new Error("FORBIDDEN");
  }
}

export function requireOwnerRole(user: SessionUser | null | undefined): void {
  if (!user) throw new Error("UNAUTHORIZED");
  if (user.role !== "SUPER_ADMIN" && user.role !== "OWNER") {
    throw new Error("FORBIDDEN");
  }
}

/**
 * Get the real session user from NextAuth.
 * Replaces the old hardcoded mock_admin_123.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const user = session.user as any;
  if (user.isSuspended) return null;

  return {
    id: user.id,
    email: user.email || "",
    role: (user.role as UserRole) || "USER",
    isSuspended: user.isSuspended || false,
  };
}
