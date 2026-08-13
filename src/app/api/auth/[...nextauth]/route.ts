/**
 * NextAuth API Route Handler
 *
 * This single file handles ALL NextAuth endpoints:
 *   GET  /api/auth/signin
 *   POST /api/auth/signin/google
 *   GET  /api/auth/callback/google   ← Google redirects here after consent
 *   POST /api/auth/signout
 *   GET  /api/auth/session
 *
 * Important: Add the callback URL to Google Cloud Console authorized redirect URIs:
 *   https://reachiq.up.railway.app/api/auth/callback/google
 */

import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth/nextauth";

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
