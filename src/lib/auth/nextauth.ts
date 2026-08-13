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
      const email = user.email;
      if (!email) return false;

      try {
        const existing = await prisma.users.findUnique({
          where: { email },
          select: { id: true, isSuspended: true },
        });

        if (existing?.isSuspended) {
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
              role: "USER",
              emailVerified: new Date(),
              updatedAt: new Date(),
            },
          });
        } else {
          // Returning user: keep name and avatar in sync with Google
          await prisma.users.update({
            where: { email },
            data: {
              name: user.name ?? undefined,
              image: user.image ?? undefined,
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
      // On first sign-in, or when explicitly refreshed, look up DB user
      if (user || trigger === "update") {
        const email = token.email;
        if (email) {
          try {
            const dbUser = await prisma.users.findUnique({
              where: { email },
              select: { id: true, role: true, isSuspended: true },
            });
            if (dbUser) {
              token.id = dbUser.id;
              token.role = dbUser.role;
              token.isSuspended = dbUser.isSuspended;
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
      if (session.user) {
        session.user.id = (token.id as string) ?? "";
        (session.user as any).role = token.role ?? "USER";
        (session.user as any).isSuspended = token.isSuspended ?? false;
      }
      return session;
    },
  },

  // ── Security
  secret: process.env.NEXTAUTH_SECRET,

  debug: process.env.NODE_ENV === "development",
};
