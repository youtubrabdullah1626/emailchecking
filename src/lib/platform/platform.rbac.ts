import { getSession } from "@/lib/auth/session";
import { isOwnerEmail } from "@/lib/auth/roles";
import prisma from "@/lib/prisma";

export type PlatformRole = "SUPER_ADMIN" | "OWNER" | "ADMIN" | "USER";

export interface SessionUser {
  id: string;
  email: string;
  role: PlatformRole;
}

/**
 * Super Admins, Owners, and Admins can modify platform configuration.
 */
export function requireSuperAdminOrOwner(user: SessionUser | null | undefined): void {
  if (!user) throw new Error("UNAUTHORIZED");
  if (isOwnerEmail(user.email)) return;
  const role = (user.role || "").toUpperCase();
  if (role !== "SUPER_ADMIN" && role !== "OWNER" && role !== "ADMIN") {
    throw new Error("FORBIDDEN: Insufficient permissions to modify platform configuration");
  }
}

/**
 * ADMINs and above can read configuration.
 */
export function requireAdminOrAbove(user: SessionUser | null | undefined): void {
  if (!user) throw new Error("UNAUTHORIZED");
  if (isOwnerEmail(user.email)) return;
  const role = (user.role || "").toUpperCase();
  if (role === "USER") {
    throw new Error("FORBIDDEN: Insufficient permissions");
  }
}

/**
 * Resolves the real authenticated session user for Platform Config.
 */
export async function getPlatformSessionUser(): Promise<SessionUser | null> {
  const session = await getSession();
  if (!session?.user) return null;

  const user = session.user;
  const isOwner = isOwnerEmail(user.email);

  let userId = user.id;
  let userRole = user.role;

  // Fallback to database lookup if id is missing in JWT session
  if (!userId && user.email) {
    try {
      const dbUser = await prisma.users.findUnique({
        where: { email: user.email },
        select: { id: true, role: true },
      });
      if (dbUser) {
        userId = dbUser.id;
        userRole = dbUser.role as any;
      }
    } catch (err) {
      console.error("[getPlatformSessionUser] Error resolving user from DB:", err);
    }
  }

  return {
    id: userId || user.email || "system_admin",
    email: user.email || "",
    role: (isOwner ? "OWNER" : userRole || "ADMIN") as PlatformRole,
  };
}

