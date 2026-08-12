import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function GET() {
  try {
    const activeAnnouncements = await prisma.announcements.findMany({
      where: {
        isActive: true,
      },
      orderBy: { scheduledAt: 'desc' },
      take: 10,
    });

    const notifications = activeAnnouncements.map(announcement => ({
      id: announcement.id,
      type: announcement.type.toLowerCase(), // e.g., 'feature', 'warning', 'info'
      title: announcement.title,
      message: announcement.message,
      timestamp: announcement.scheduledAt.toISOString(),
      isRead: false,
      link: announcement.link || undefined
    }));

    return NextResponse.json({ notifications });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch announcements" }, { status: 500 });
  }
}
