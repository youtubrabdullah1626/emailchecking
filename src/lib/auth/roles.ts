import { UserRole } from "@/types/next-auth";

export const OWNER_EMAILS = [
  "youtubrabdullah1626@gmail.com",
  "abdullahblog1626@gmail.com",
  (process.env.ADMIN_EMAIL || "").toLowerCase().trim(),
  (process.env.GMAIL_SENDER_EMAIL || "").toLowerCase().trim(),
].filter(Boolean);

/**
 * Checks if the given email belongs to the platform Owner.
 */
export function isOwnerEmail(email?: string | null): boolean {
  if (!email) return false;
  const normalized = email.toLowerCase().trim();
  return (
    OWNER_EMAILS.includes(normalized) ||
    normalized === "youtubrabdullah1626@gmail.com" ||
    normalized === "abdullahblog1626@gmail.com"
  );
}

/**
 * Validates if a user has a specific role or higher.
 * 
 * Hierarchy:
 * OWNER / SUPER_ADMIN > ADMIN > ADMIN_VIEWER > HELPER > USER
 */
export function hasRole(
  userRole: string | undefined | null,
  requiredRole: UserRole,
  userEmail?: string | null
): boolean {
  if (userEmail && isOwnerEmail(userEmail)) return true;
  if (!userRole) return false;
  
  const roleHierarchy: Record<string, number> = {
    USER: 1,
    HELPER: 2,
    ADMIN_VIEWER: 3,
    ADMIN: 4,
    SUPER_ADMIN: 5,
    OWNER: 5,
  };

  const userLevel = roleHierarchy[userRole.toUpperCase()] || 1;
  const requiredLevel = roleHierarchy[requiredRole] || 1;

  return userLevel >= requiredLevel;
}
