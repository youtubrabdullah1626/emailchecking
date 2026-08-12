/**
 * RBAC for Platform Configuration
 *
 * Stricter than the audit RBAC — only SUPER_ADMIN and OWNER can mutate config.
 * ADMINs are read-only. USERs have no access.
 */

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
  if (user.role !== "SUPER_ADMIN" && user.role !== "OWNER") {
    throw new Error("FORBIDDEN: Only Super Admins and Owners may modify platform configuration");
  }
}

/**
 * ADMINs and above can read configuration.
 */
export function requireAdminOrAbove(user: SessionUser | null | undefined): void {
  if (!user) throw new Error("UNAUTHORIZED");
  if (user.role === "USER") {
    throw new Error("FORBIDDEN: Insufficient permissions");
  }
}

/**
 * Resolves the session user. Replace with real NextAuth session in Phase 17.3.
 */
export async function getPlatformSessionUser(): Promise<SessionUser | null> {
  // Integration Point: Replace with real Identity Provider session in future phase
  // (e.g. `await getServerSession(authOptions)` or `supabase.auth.getSession()`)
  return {
    id: "mock_admin_123",
    email: "admin@enterprise.local",
    role: "SUPER_ADMIN",
  };
}
