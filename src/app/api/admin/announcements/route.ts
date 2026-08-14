import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const announcements = await prisma.announcements.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json({ announcements });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch announcements" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    const body = await req.json();
    const { title, message, type, link, buttonText, scheduledAt, expiresAt, isActive } = body;

    if (!title || !message || !type) {
      return NextResponse.json({ error: "Missing required fields (title, message, type)" }, { status: 400 });
    }

    const startDate = scheduledAt ? new Date(scheduledAt) : new Date();
    const endDate = expiresAt ? new Date(expiresAt) : null;

    if (isNaN(startDate.getTime())) {
      return NextResponse.json({ error: "Invalid scheduled start date" }, { status: 400 });
    }

    if (endDate && isNaN(endDate.getTime())) {
      return NextResponse.json({ error: "Invalid expiration end date" }, { status: 400 });
    }

    if (endDate && endDate <= startDate) {
      return NextResponse.json({ error: "Expiration date must be after scheduled start date" }, { status: 400 });
    }

    const announcement = await prisma.announcements.create({
      data: {
        id: crypto.randomUUID(),
        title: title.trim(),
        message: message.trim(),
        type,
        link: link ? link.trim() : null,
        buttonText: buttonText ? buttonText.trim() : null,
        scheduledAt: startDate,
        expiresAt: endDate,
        authorId: session?.user?.id || session?.user?.email || "admin",
        isActive: typeof isActive === "boolean" ? isActive : true,
        updatedAt: new Date()
      }
    });

    return NextResponse.json({ announcement });
  } catch (error) {
    console.error("[POST /api/admin/announcements] Error:", error);
    return NextResponse.json({ error: "Failed to create announcement" }, { status: 500 });
  }
}

