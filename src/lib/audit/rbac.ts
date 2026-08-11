/**
 * Enterprise Role-Based Access Control (RBAC) Abstraction
 * 
 * Provides an extensible authorization model that can integrate with
 * future User Management modules without modifying the Audit module.
 */

export type UserRole = "SUPER_ADMIN" | "OWNER" | "ADMIN" | "USER";

export interface SessionUser {
  id: string;
  email: string;
  role: UserRole;
}

/**
 * Validates if the user has the required permission level.
 * Throws an error if unauthorized to prevent logic leaking.
 */
export function requireAdminRole(user: SessionUser | null | undefined): void {
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }
  
  if (user.role !== "SUPER_ADMIN" && user.role !== "OWNER" && user.role !== "ADMIN") {
    throw new Error("FORBIDDEN");
  }
}

/**
 * Resolves the current session user. 
 * Placeholder for actual NextAuth / Supabase session retrieval.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  // In a real application, this would decode the JWT or query the DB.
  // For now, we mock a SUPER_ADMIN session for development/demonstration.
  // TODO: Replace with actual session logic (`await getServerSession(authOptions)`)
  return {
    id: "mock_admin_123",
    email: "admin@enterprise.local",
    role: "SUPER_ADMIN"
  };
}
