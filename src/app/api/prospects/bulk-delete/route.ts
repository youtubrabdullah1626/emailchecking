import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { errorTracker } from "@/lib/observability/errors";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { emails } = body;

    if (!Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json({ error: "Invalid or empty emails array" }, { status: 400 });
    }

    const lowercaseEmails = emails.map(e => String(e).toLowerCase());

    const result = await prisma.prospect.deleteMany({
      where: {
        email: {
          in: lowercaseEmails
        }
      }
    });

    return NextResponse.json({ ok: true, count: result.count });
  } catch (err: any) {
    await errorTracker.trackError({
      service: "Database",
      category: "Database",
      severity: "HIGH",
      message: `[bulk-delete-prospects] Unexpected error: ${err instanceof Error ? err.message : String(err)}`,
      error: err
    });
    return NextResponse.json({ error: "Failed to delete prospects" }, { status: 500 });
  }
}
