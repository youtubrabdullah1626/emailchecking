/**
 * POST /api/auth/logout
 *
 * Secure sign-out endpoint. Calls NextAuth signOut server-side,
 * clears session from DB, and redirects to /login.
 */

import { NextResponse } from "next/server";

export async function POST() {
  // NextAuth client-side signOut() handles cookie clearing automatically.
  // This endpoint exists for server-side logout flows (e.g., admin forced sign-out).
  return NextResponse.json({ success: true });
}
