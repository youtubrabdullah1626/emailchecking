import { getSession } from "@/lib/auth/session";
import { isOwnerEmail } from "@/lib/auth/roles";

export type PlatformRole = "SUPER_ADMIN" | "OWNER" | "ADMIN" | "USER";

export interface SessionUser {
  id: string;
  email: string;
  role: PlatformRole;
}

/**
 * Only SUPER_ADMIN and OWNER can modify platform configuration.
 */
export function requireSuperAdminOrOwner(user: SessionUser | null | undefined): void {
  if (!user) throw new Error("UNAUTHORIZED");
  if (isOwnerEmail(user.email)) return;
  if (user.role !== "SUPER_ADMIN" && user.role !== "OWNER") {
    throw new Error("FORBIDDEN: Only Super Admins and Owners may modify platform configuration");
  }
}

/**
 * ADMINs and above can read configuration.
 */
export function requireAdminOrAbove(user: SessionUser | null | undefined): void {
  if (!user) throw new Error("UNAUTHORIZED");
  if (isOwnerEmail(user.email)) return;
  if (user.role === "USER") {
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

  return {
    id: user.id,
    email: user.email || "",
    role: (isOwner ? "OWNER" : user.role) as PlatformRole,
  };
}
