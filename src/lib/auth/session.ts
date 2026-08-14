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
import prisma from "@/lib/prisma";

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

    // Smart SaaS Feature: Always fetch the freshed role and suspension status from the DB
    // This prevents JWT caching issues where a user upgrades to OWNER but is still treated as a USER
    const dbUser = await prisma.users.findUnique({
      where: { email: user.email },
      select: { role: true, isSuspended: true }
    });

    if (!dbUser || dbUser.isSuspended) {
      return null;
    }

    return {
      user: {
        id: user.id,
        email: user.email || "",
        name: user.name || undefined,
        role: dbUser.role || "USER",
        isSuspended: dbUser.isSuspended || false,
      },
    };
  } catch (error) {
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
