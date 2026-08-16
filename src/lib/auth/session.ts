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

    if (!session?.user?.email) {
      return null;
    }

    const { isOwnerEmail } = await import("@/lib/auth/roles");
    const user = session.user as any;
    const email = user.email.toLowerCase().trim();
    const isOwner = isOwnerEmail(email);

    // Suspended users are treated as logged-out (except owner fail-safe)
    if (user.isSuspended && !isOwner) {
      return null;
    }

    // Always fetch fresh record from DB
    let dbUser = await prisma.users.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true, role: true, isSuspended: true, name: true }
    });

    if (!dbUser && isOwner) {
      // Auto-create owner record in DB if missing
      dbUser = await prisma.users.create({
        data: {
          email,
          name: user.name || "Owner",
          role: "OWNER",
          updatedAt: new Date(),
        },
        select: { id: true, role: true, isSuspended: true, name: true }
      });
    }

    if (!dbUser) {
      return null;
    }

    if (dbUser.isSuspended && !isOwner) {
      return null;
    }

    // If owner but role is not OWNER in DB, silently promote to OWNER
    if (isOwner && dbUser.role !== "OWNER") {
      prisma.users.update({
        where: { id: dbUser.id },
        data: { role: "OWNER", isSuspended: false }
      }).catch(() => {});
    }

    return {
      user: {
        id: dbUser.id || user.id,
        email,
        name: dbUser.name || user.name || undefined,
        role: isOwner ? "OWNER" : (dbUser.role || "USER"),
        isSuspended: isOwner ? false : (dbUser.isSuspended || false),
      },
    };
  } catch (error) {
    // Fail closed — deny access if session resolution fails
    console.error("[Universal Session] Error resolving session:", error);
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
