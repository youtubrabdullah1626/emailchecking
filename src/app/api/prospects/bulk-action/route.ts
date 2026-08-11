import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { errorTracker } from "@/lib/observability/errors";
import { auditService } from "@/lib/audit/audit.service";
import { getSessionUser } from "@/lib/audit/rbac";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { emails, action } = body; // action is "DELETE" or "CANCEL"

    if (!Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json({ error: "Invalid or empty emails array" }, { status: 400 });
    }

    const lowercaseEmails = emails.map(e => String(e).toLowerCase());

    if (action === "DELETE") {
      const result = await prisma.prospect.deleteMany({
        where: {
          email: {
            in: lowercaseEmails
          }
        }
      });
      
      const user = await getSessionUser();
      auditService.logAction(
        user?.id || 'system',
        user?.email || 'system',
        'PROSPECTS_DELETED',
        'DELETE',
        `${result.count} Prospects`,
        'Prospect Batch',
        'SUCCESS',
        { metadata: { count: result.count, emails: lowercaseEmails } }
      );
      
      return NextResponse.json({ ok: true, count: result.count, action: "DELETE" });
    } else if (action === "CANCEL") {
      // Set prospect status to STOPPED instead of deleting
      const result = await prisma.prospect.updateMany({
        where: {
          email: {
            in: lowercaseEmails
          }
        },
        data: {
          status: "STOPPED"
        }
      });
      
      const user = await getSessionUser();
      auditService.logAction(
        user?.id || 'system',
        user?.email || 'system',
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
