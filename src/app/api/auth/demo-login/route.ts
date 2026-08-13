import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

export async function GET() {
  const cookieStore = cookies();
  
  // Create or get the first user in the database to act as the demo user
  const demoUser = await prisma.users.findFirst() || await prisma.users.create({
    data: {
      id: crypto.randomUUID(),
      email: "demo@reachiq.app",
      name: "Demo User",
      role: "ADMIN",
      updatedAt: new Date()
    }
  });

  // Set the mock cookies that session.ts expects
  cookieStore.set("mock_user_id", demoUser.id, { path: "/", maxAge: 60 * 60 * 24 * 7 });
  cookieStore.set("mock_user_email", demoUser.email || "demo@reachiq.app", { path: "/", maxAge: 60 * 60 * 24 * 7 });
  cookieStore.set("mock_user_role", demoUser.role, { path: "/", maxAge: 60 * 60 * 24 * 7 });

  // Redirect to dashboard
  return NextResponse.redirect(new URL("/dashboard", process.env.NEXT_PUBLIC_APP_URL || "https://reachiq.up.railway.app"));
}
