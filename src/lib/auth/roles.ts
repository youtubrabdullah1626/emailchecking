import { UserRole } from "@/types/next-auth";

/**
 * Validates if a user has a specific role or higher.
 * 
 * Hierarchy:
 * OWNER > ADMIN > ADMIN_VIEWER > HELPER > USER
 */
export function hasRole(userRole: string | undefined | null, requiredRole: UserRole): boolean {
  if (!userRole) return false;
  
  const roleHierarchy: Record<string, number> = {
    USER: 1,
    HELPER: 2,
    ADMIN_VIEWER: 3,
    ADMIN: 4,
    OWNER: 5,
  };

  const userLevel = roleHierarchy[userRole.toUpperCase()] || 1;
  const requiredLevel = roleHierarchy[requiredRole] || 1;

  return userLevel >= requiredLevel;
}
