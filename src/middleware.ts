/**
 * Next.js Middleware — Global Route Protection
 *
 * Runs on EVERY request before the page renders.
 * Unauthenticated users are redirected to /login.
 * Authenticated users on /login are redirected to /dashboard.
 *
 * Public routes (no auth required):
 *  - /login
 *  - /api/auth/* (NextAuth endpoints)
 *  - /_next/* (static assets)
 *  - /favicon.ico
 */

import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const token = req.nextauth.token;

    // Already logged in and hitting /login → go to dashboard
    if (token && pathname === "/login") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      // Return true = allow, false = redirect to /login
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl;

        // Always allow public routes
        if (
          pathname.startsWith("/api/auth") ||
          pathname.startsWith("/api/track") ||
          pathname.startsWith("/api/webhooks") ||
          pathname.startsWith("/api/unsubscribe") ||
          pathname.startsWith("/api/scheduler") ||
          pathname === "/login" ||
          pathname.startsWith("/_next") ||
          pathname === "/favicon.ico"
        ) {
          return true;
        }

        // All other routes require a valid session token
        return !!token;
      },
    },
    pages: {
      signIn: "/login",
    },
  }
);

// Apply middleware to all routes except Next.js internals and static files
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
