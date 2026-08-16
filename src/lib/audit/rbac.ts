import { getSession } from "@/lib/auth/session";
import { isOwnerEmail } from "@/lib/auth/roles";

export type UserRole = "SUPER_ADMIN" | "OWNER" | "ADMIN" | "USER";

export interface SessionUser {
  id: string;
  email: string;
  role: UserRole;
  isSuspended?: boolean;
}

export function requireAdminRole(user: SessionUser | null | undefined): void {
  if (!user) throw new Error("UNAUTHORIZED");
  if (isOwnerEmail(user.email)) return;
  if (user.role !== "SUPER_ADMIN" && user.role !== "OWNER" && user.role !== "ADMIN") {
    throw new Error("FORBIDDEN");
  }
}

export function requireOwnerRole(user: SessionUser | null | undefined): void {
  if (!user) throw new Error("UNAUTHORIZED");
  if (isOwnerEmail(user.email)) return;
  if (user.role !== "SUPER_ADMIN" && user.role !== "OWNER") {
    throw new Error("FORBIDDEN");
  }
}

/**
 * Get the real session user from NextAuth.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getSession();
  if (!session?.user) return null;

  const user = session.user;
  const isOwner = isOwnerEmail(user.email);
  if (user.isSuspended && !isOwner) return null;

  return {
    id: user.id,
    email: user.email || "",
    role: (isOwner ? "OWNER" : (user.role as UserRole)) || "USER",
    isSuspended: isOwner ? false : (user.isSuspended || false),
  };
}
