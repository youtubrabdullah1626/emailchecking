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

    // Always fetch fresh record from DB with fast retry on connection glitches
    let dbUser = await prisma.users.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true, role: true, isSuspended: true, name: true }
    }).catch(async () => {
      // Fast 1-retry on transient DB pool drops
      await new Promise(r => setTimeout(r, 150));
      return prisma.users.findFirst({
        where: { email: { equals: email, mode: "insensitive" } },
        select: { id: true, role: true, isSuspended: true, name: true }
      }).catch(() => null);
    });

    if (!dbUser) {
      // Auto-create user record in DB if missing for any authenticated NextAuth user
      try {
        dbUser = await prisma.users.create({
          data: {
            email,
            name: user.name || (isOwner ? "Owner" : "User"),
            role: isOwner ? "OWNER" : "USER",
            updatedAt: new Date(),
          },
          select: { id: true, role: true, isSuspended: true, name: true }
        });
      } catch {
        // Fallback: If DB write fails, gracefully use verified NextAuth token identity
        dbUser = {
          id: user.id || email,
          role: isOwner ? "OWNER" : (user.role || "USER"),
          isSuspended: false,
          name: user.name || undefined
        };
      }
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

    // Resolve primary workspace owner ID so all connected inboxes share the unified workspace
    let primaryUserId = dbUser.id || user.id;
    if (isOwner) {
      const primaryOwner = await prisma.users.findFirst({
        where: { email: "youtubrabdullah1626@gmail.com" },
        select: { id: true }
      }).catch(() => null);
      if (primaryOwner) {
        primaryUserId = primaryOwner.id;
      }
    }

    return {
      user: {
        id: primaryUserId,
        email,
        name: dbUser.name || user.name || undefined,
        role: isOwner ? "OWNER" : (dbUser.role || "USER"),
        isSuspended: isOwner ? false : (dbUser.isSuspended || false),
      },
    };
  } catch (error) {
    console.error("[Universal Session] Error resolving session:", error);
    // If NextAuth session exists with valid email, fall back to safe session
    try {
      const rawSession = await getServerSession(authOptions);
      if (rawSession?.user?.email) {
        const { isOwnerEmail } = await import("@/lib/auth/roles");
        const email = rawSession.user.email.toLowerCase().trim();
        const isOwner = isOwnerEmail(email);
        return {
          user: {
            id: (rawSession.user as any).id || email,
            email,
            name: rawSession.user.name || undefined,
            role: isOwner ? "OWNER" : "USER",
            isSuspended: false,
          }
        };
      }
    } catch {}
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
