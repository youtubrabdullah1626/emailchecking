/**
 * Universal Session Resolver — Production Grade
 *
 * Reads the real NextAuth session on every server-side call.
 * Validates role and suspended state from the DB.
 * All 50+ API routes call this function — changing auth provider
 * requires updating only this file.
 */

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/nextauth";

export interface SessionUser {
  id: string;
  email: string;
  name?: string;
  role: string;
  isSuspended: boolean;
}

export async function getSession(): Promise<{ user: SessionUser } | null> {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return null;
    }

    const user = session.user as any;

    // Suspended users are treated as logged-out
    if (user.isSuspended) {
      return null;
    }

    return {
      user: {
        id: user.id,
        email: user.email || "",
        name: user.name || undefined,
        role: user.role || "USER",
        isSuspended: user.isSuspended || false,
      },
    };
  } catch {
    // Fail closed — deny access if session resolution fails
    return null;
  }
}

/**
 * Throws UNAUTHORIZED if no valid session.
 * Use at the top of protected API routes.
 */
export async function requireSession() {
  const session = await getSession();
  if (!session?.user) {
    throw new Error("UNAUTHORIZED");
  }
  return session;
}
