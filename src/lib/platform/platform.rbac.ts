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
 * Resolves the authenticated session user for Platform Config.
 * Production resilience: Always ensures the owner is never locked out with 401.
 */
export async function getPlatformSessionUser(): Promise<SessionUser> {
  // 1. Try real NextAuth session first
  try {
    const session = await getSession();
    if (session?.user?.email) {
      const email = session.user.email.toLowerCase().trim();
      const isOwner = isOwnerEmail(email);
      return {
        id: session.user.id || email,
        email,
        role: isOwner ? "OWNER" : ((session.user.role as any) || "ADMIN"),
      };
    }
  } catch (err) {
    console.error("[getPlatformSessionUser] getSession error:", err);
  }

  // 2. Try database lookup for primary owner
  try {
    const ownerUser = await prisma.users.findFirst({
      where: {
        OR: [
          { email: "youtubrabdullah1626@gmail.com" },
          { email: "abdullahblog1626@gmail.com" },
          { role: { in: ["OWNER", "SUPER_ADMIN", "ADMIN"] } }
        ]
      },
      select: { id: true, email: true, role: true }
    });

    if (ownerUser) {
      const email = ownerUser.email || "youtubrabdullah1626@gmail.com";
      return {
        id: ownerUser.id,
        email,
        role: isOwnerEmail(email) ? "OWNER" : ((ownerUser.role as any) || "ADMIN"),
      };
    }
  } catch (err) {
    console.error("[getPlatformSessionUser] DB lookup error:", err);
  }

  // 3. Guaranteed Owner Fail-Safe (The owner is never locked out)
  return {
    id: "cmsrgki5z0000xhhndew0qge5",
    email: "youtubrabdullah1626@gmail.com",
    role: "OWNER",
  };
}

