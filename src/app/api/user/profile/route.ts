import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { checkTimezoneCooldown } from "@/lib/date-utils";
import { ALL_TIMEZONES } from "@/lib/timezones";

export const dynamic = "force-dynamic";

function isValidIanaTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.users.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        timezone: true,
        timezone_updated_at: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const cooldown = checkTimezoneCooldown(user.timezone_updated_at);

    return NextResponse.json({
      name: user.name || "",
      email: user.email,
      timezone: user.timezone || "UTC",
      timezoneUpdatedAt: user.timezone_updated_at?.toISOString() || null,
      cooldown,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch profile";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, timezone } = body;

    const user = await prisma.users.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        timezone: true,
        timezone_updated_at: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const updateData: {
      name?: string;
      timezone?: string;
      timezone_updated_at?: Date;
    } = {};

    if (typeof name === "string") {
      updateData.name = name.trim();
    }

    if (timezone && typeof timezone === "string") {
      const trimmed = timezone.trim();
      // Case-insensitive match against ALL_TIMEZONES or valid IANA timezone
      const curatedMatch = ALL_TIMEZONES.find((t) => t.value.toLowerCase() === trimmed.toLowerCase());
      const normalizedTimezone = curatedMatch ? curatedMatch.value : (isValidIanaTimezone(trimmed) ? trimmed : null);

      if (!normalizedTimezone) {
        return NextResponse.json(
          { error: "Invalid IANA timezone identifier provided (e.g. 'America/New_York' or 'Asia/Karachi')." },
          { status: 400 }
        );
      }

      if (normalizedTimezone !== user.timezone) {
        const cooldown = checkTimezoneCooldown(user.timezone_updated_at);
        if (!cooldown.canChange) {
          return NextResponse.json(
            {
              error: `Timezone can only be changed once every 7 days. You can change it again in ${cooldown.remainingDays} day(s).`,
              cooldown,
            },
            { status: 400 }
          );
        }

        updateData.timezone = normalizedTimezone;
        updateData.timezone_updated_at = new Date();
      }
    }

    const updatedUser = await prisma.users.update({
      where: { id: session.user.id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        timezone: true,
        timezone_updated_at: true,
      },
    });

    const newCooldown = checkTimezoneCooldown(updatedUser.timezone_updated_at);

    return NextResponse.json({
      success: true,
      user: {
        name: updatedUser.name,
        email: updatedUser.email,
        timezone: updatedUser.timezone,
        timezoneUpdatedAt: updatedUser.timezone_updated_at?.toISOString() || null,
        cooldown: newCooldown,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update profile";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
