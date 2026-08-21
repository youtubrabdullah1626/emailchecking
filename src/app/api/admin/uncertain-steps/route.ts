import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// Dummy auth check for admin routes
function isAuthenticated(req: Request) {
  const authHeader = req.headers.get("Authorization");
  const ADMIN_SECRET = process.env.ADMIN_API_SECRET;
  if (!ADMIN_SECRET) return false; // Force-fail if env var not set
  return authHeader === `Bearer ${ADMIN_SECRET}`;
}

export async function GET(req: Request) {
  if (!isAuthenticated(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const steps = await prisma.sequenceStep.findMany({
    where: {
      OR: [
        { status: "UNCERTAIN" },
        { send_attempts: { some: { status: "UNRESOLVABLE" } } }
      ]
    },
    include: {
      send_attempts: true
    }
  });

  return NextResponse.json({ steps });
}

export async function POST(req: Request) {
  if (!isAuthenticated(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { stepId, resolution } = body;

  if (!stepId || !["SENT", "CANCELLED"].includes(resolution)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const updated = await prisma.sequenceStep.update({
    where: { id: stepId },
    data: { status: resolution }
  });

  return NextResponse.json({ success: true, updated });
}
