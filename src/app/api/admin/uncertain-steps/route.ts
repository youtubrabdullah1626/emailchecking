import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";

async function isAuthorizedAdmin(req: Request): Promise<boolean> {
  const authHeader = req.headers.get("Authorization");
  const ADMIN_SECRET = process.env.ADMIN_API_SECRET;
  if (ADMIN_SECRET && authHeader === `Bearer ${ADMIN_SECRET}`) {
    return true;
  }
  const session = await getSession();
  if (session?.user?.role === "ADMIN" || session?.user?.role === "SUPER_ADMIN" || session?.user?.role === "OWNER") {
    return true;
  }
  return false;
}

export async function GET(req: Request) {
  if (!(await isAuthorizedAdmin(req))) {
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
  if (!(await isAuthorizedAdmin(req))) {
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
