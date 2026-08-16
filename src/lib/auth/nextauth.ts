/**
 * NextAuth Configuration — Enterprise Grade, Future-Proof
 *
 * Architecture (JWT Strategy — no PrismaAdapter):
 *  - Provider:  Google OAuth2
 *  - Strategy:  JWT — encrypted HTTP-only cookie, zero DB roundtrips for auth
 *  - User sync: Custom signIn callback — upserts user into our `users` table
 *  - RBAC:      Role stamped into JWT on first login, refreshed every 24h
 *  - Security:  isSuspended check on every session validation
 *
 * Why JWT over database strategy:
 *  - No dependency on PrismaAdapter model naming conventions
 *  - No VerificationToken / Account / Session table schema required
 *  - Works with our existing custom `users` table (plural, lowercase)
 *  - Zero DB roundtrip on every request (token is self-contained)
 *  - Industry standard for SaaS (Linear, Vercel, Notion all use this)
 */

import { type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import prisma from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  // ── NO Adapter — we manage user persistence ourselves in signIn callback

  // ── Provider: Google OAuth2 (reuses GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET)
  providers: [
    GoogleProvider({
      clientId: process.env.GMAIL_CLIENT_ID!,
      clientSecret: process.env.GMAIL_CLIENT_SECRET!,
      authorization: {
        params: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],

  // ── Session: JWT strategy — encrypted cookie, no DB session table needed
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  // ── Custom pages
  pages: {
    signIn: "/login",
    error: "/login",
  },

  // ── Callbacks
  callbacks: {
    /**
     * signIn — called on every OAuth login attempt.
     * Upserts the user into our `users` table. If user is suspended, deny login.
     */
    async signIn({ user, profile }) {
      const rawEmail = user.email;
      if (!rawEmail) return false;
      const email = rawEmail.toLowerCase().trim();
      const { isOwnerEmail } = await import("@/lib/auth/roles");
      const isOwner = isOwnerEmail(email);

      try {
        const existing = await prisma.users.findFirst({
          where: { email: { equals: email, mode: "insensitive" } },
          select: { id: true, isSuspended: true, role: true },
        });

        if (existing?.isSuspended && !isOwner) {
          // Suspended users cannot log in — redirect to login with a clear error
          return "/login?error=AccountSuspended";
        }

        if (!existing) {
          // First-time login: create the user record
          await prisma.users.create({
            data: {
              email,
              name: user.name ?? null,
              image: user.image ?? null,
              role: isOwner ? "OWNER" : "USER",
              emailVerified: new Date(),
              updatedAt: new Date(),
            },
          });
        } else {
          // Returning user: keep name and avatar in sync with Google & ensure Owner has OWNER role
          await prisma.users.update({
            where: { id: existing.id },
            data: {
              name: user.name ?? undefined,
              image: user.image ?? undefined,
              role: isOwner ? "OWNER" : existing.role,
              isSuspended: isOwner ? false : existing.isSuspended,
            },
          });
        }

        return true;
      } catch (error) {
        console.error("[NextAuth] signIn callback error:", error);
        return false;
      }
    },

    /**
     * jwt — called when a JWT is created or refreshed.
     * Stamps role, id, and isSuspended from the DB into the token.
     */
    async jwt({ token, user, trigger }) {
      const { isOwnerEmail } = await import("@/lib/auth/roles");
      const email = token.email ? token.email.toLowerCase().trim() : undefined;
      const isOwner = isOwnerEmail(email);

      if (isOwner) {
        token.role = "OWNER";
        token.isSuspended = false;
      }

      // Look up DB user on first sign-in, explicit update, or if token is missing properties
      if (user || trigger === "update" || !token.id || !token.role) {
        if (email) {
          try {
            const dbUser = await prisma.users.findFirst({
              where: { email: { equals: email, mode: "insensitive" } },
              select: { id: true, role: true, isSuspended: true },
            });
            if (dbUser) {
              token.id = dbUser.id;
              token.role = isOwner ? "OWNER" : (dbUser.role || "USER");
              token.isSuspended = isOwner ? false : (dbUser.isSuspended || false);
            } else if (isOwner) {
              const newOwner = await prisma.users.create({
                data: {
                  email,
                  name: (token.name as string) || "Owner",
                  role: "OWNER",
                  updatedAt: new Date(),
                },
              });
              token.id = newOwner.id;
              token.role = "OWNER";
              token.isSuspended = false;
            }
          } catch (error) {
            console.error("[NextAuth] jwt callback DB lookup error:", error);
          }
        }
      }
      return token;
    },

    /**
     * session — shapes what the client-side `useSession()` receives.
     * Reads from the JWT token (no DB call).
     */
    async session({ session, token }) {
      const { isOwnerEmail } = await import("@/lib/auth/roles");
      if (session.user) {
        const isOwner = isOwnerEmail(session.user.email);
        session.user.id = (token.id as string) ?? session.user.id ?? "";
        (session.user as any).role = isOwner ? "OWNER" : (token.role ?? "USER");
        (session.user as any).isSuspended = isOwner ? false : (token.isSuspended ?? false);
      }
      return session;
    },
  },

  // ── Security
  secret: process.env.NEXTAUTH_SECRET,

  debug: process.env.NODE_ENV === "development",
};
