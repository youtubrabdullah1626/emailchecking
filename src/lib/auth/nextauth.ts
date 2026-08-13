/**
 * NextAuth Configuration — Single Source of Truth
 *
 * This is the ONLY place NextAuth is configured. Import `authOptions`
 * into the route handler and `getServerSession` wherever you need the session.
 *
 * Architecture:
 *  - Provider:  Google OAuth2 (reuses GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET)
 *  - Adapter:   PrismaAdapter — persists users, accounts, sessions to PostgreSQL
 *  - Strategy:  database — HTTP-only cookie holds session token, validated per-request
 *  - Security:  Role is stamped onto the session from the DB on every request
 */

import { type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import prisma from "@/lib/prisma";
import type { Adapter } from "next-auth/adapters";

export const authOptions: NextAuthOptions = {
  // ── Adapter: stores users / accounts / sessions in your existing Supabase tables
  adapter: PrismaAdapter(prisma) as Adapter,

  // ── Provider: Google OAuth2
  providers: [
    GoogleProvider({
      clientId: process.env.GMAIL_CLIENT_ID!,
      clientSecret: process.env.GMAIL_CLIENT_SECRET!,
      authorization: {
        params: {
          // Request offline access so we get a refresh token for Gmail sending
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],

  // ── Session: database strategy (tokens in DB, not JWTs)
  session: {
    strategy: "database",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  // ── Custom pages
  pages: {
    signIn: "/login",
    error: "/login",
  },

  // ── Callbacks: enrich the session object with role and id from the DB
  callbacks: {
    async session({ session, user }) {
      if (session.user && user) {
        session.user.id = user.id;
        // Pull role and isSuspended from the DB user record
        const dbUser = await prisma.users.findUnique({
          where: { id: user.id },
          select: { role: true, isSuspended: true },
        });
        (session.user as any).role = dbUser?.role ?? "USER";
        (session.user as any).isSuspended = dbUser?.isSuspended ?? false;
      }
      return session;
    },
  },

  // ── Events: auto-stamp updatedAt on new user creation (schema requires it)
  events: {
    async createUser({ user }) {
      await prisma.users.update({
        where: { id: user.id },
        data: { updatedAt: new Date() },
      });
    },
  },

  // ── Security
  secret: process.env.NEXTAUTH_SECRET,

  debug: process.env.NODE_ENV === "development",
};
