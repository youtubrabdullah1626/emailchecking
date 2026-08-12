import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

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
    const body = await req.json();
    const { title, message, type, link, buttonText } = body;

    if (!title || !message || !type) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const announcement = await prisma.announcements.create({
      data: {
        id: crypto.randomUUID(),
        title,
        message,
        type,
        link: link || null,
        buttonText: buttonText || null,
        authorId: "admin", // Hardcoded for now, could be dynamic based on session
        isActive: true,
        updatedAt: new Date()
      }
    });

    return NextResponse.json({ announcement });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create announcement" }, { status: 500 });
  }
}
