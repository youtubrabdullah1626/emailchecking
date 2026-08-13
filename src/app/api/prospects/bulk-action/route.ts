import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { errorTracker } from "@/lib/observability/errors";
import { auditService } from "@/lib/audit/audit.service";
import { getSession } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  // ── Auth Guard — must be first, before any business logic ─────────────────
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { emails, action } = body; // action is "DELETE" or "CANCEL"

    if (!Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json({ error: "Invalid or empty emails array" }, { status: 400 });
    }

    const lowercaseEmails = emails.map(e => String(e).toLowerCase());

    if (action === "DELETE") {
      // FIXED: user_id: session.user.id ensures only the caller's own prospects are deleted
      const result = await prisma.prospect.deleteMany({
        where: {
          email: { in: lowercaseEmails },
          user_id: session.user.id,
        }
      });
      
      auditService.logAction(
        session.user.id,
        session.user.email,
        'PROSPECTS_DELETED',
        'DELETE',
        `${result.count} Prospects`,
        'Prospect Batch',
        'SUCCESS',
        { metadata: { count: result.count, emails: lowercaseEmails } }
      );
      
      return NextResponse.json({ ok: true, count: result.count, action: "DELETE" });
    } else if (action === "CANCEL") {
      // FIXED: user_id: session.user.id ensures only the caller's own prospects are updated
      const result = await prisma.prospect.updateMany({
        where: {
          email: { in: lowercaseEmails },
          user_id: session.user.id,
        },
        data: { status: "STOPPED" }
      });
      
      auditService.logAction(
        session.user.id,
        session.user.email,
        'PROSPECTS_STOPPED',
        'UPDATE',
        `${result.count} Prospects`,
        'Prospect Batch',
        'SUCCESS',
        { metadata: { count: result.count } }
      );
      
      return NextResponse.json({ ok: true, count: result.count, action: "CANCEL" });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    await errorTracker.trackError({
      service: "Database",
      category: "Database",
      severity: "HIGH",
      message: `[bulk-action-prospects] Unexpected error: ${err instanceof Error ? err.message : String(err)}`,
      error: err
    });
    return NextResponse.json({ error: "Failed to perform bulk action" }, { status: 500 });
  }
}
