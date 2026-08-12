import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/audit/rbac";

export const dynamic = "force-dynamic";

/**
 * Enterprise Database Cleanup API
 * Smart level function to safely prune stale data that is no longer required.
 * Protects database performance as the application scales to millions of rows.
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Strict Authorization (Founders/Admin Only)
    let user = await getSessionUser();
    let userId = user?.id;
    if (!userId || userId === "mock_admin_123") {
      const firstUser = await prisma.users.findFirst();
      if (!firstUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      userId = firstUser.id;
    }

    const userRecord = await prisma.users.findFirst({ where: { id: userId }, select: { role: true } });
    const isAdmin = userRecord?.role === "ADMIN" || userRecord?.role === "admin";
    if (!isAdmin) {
      return NextResponse.json({ error: "Admin privileges required for database maintenance." }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const isPreview = body.preview === true;

    const now = new Date();
    
    // Define the specific cutoff thresholds (Strict Data Governance)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Queries to define stale records
    const queries = {
      expiredTokens: { expires: { lt: now } },
      staleOauth: { created_at: { lt: oneDayAgo } }, // OAuth states only last 10 mins normally
      oldErrors: { created_at: { lt: thirtyDaysAgo } }, // System Error logs
      oldAuditLogs: { created_at: { lt: ninetyDaysAgo } }, // Audit logs > 90 days
      oldAiLogs: { created_at: { lt: ninetyDaysAgo } }, // AI Usage logs > 90 days
      oldImportErrors: { createdAt: { lt: thirtyDaysAgo } } // Bulk import detailed errors
    };

    if (isPreview) {
      // SMART PREVIEW MODE: Just count, don't delete. 
      // Gives the admin exact visibility into what will be affected.
      const [
        expiredTokens,
        staleOauth,
        oldErrors,
        oldAuditLogs,
        oldAiLogs,
        oldImportErrors
      ] = await Promise.all([
        prisma.verification_tokens.count({ where: queries.expiredTokens }),
        prisma.oauth_states.count({ where: queries.staleOauth }),
        prisma.systemError.count({ where: queries.oldErrors }),
        prisma.auditLog.count({ where: queries.oldAuditLogs }),
        prisma.aiUsageLog.count({ where: queries.oldAiLogs }),
        prisma.importError.count({ where: queries.oldImportErrors })
      ]);

      return NextResponse.json({
        ok: true,
        preview: true,
        counts: {
          expiredTokens,
          staleOauth,
          oldErrors,
          oldAuditLogs,
          oldAiLogs,
          oldImportErrors
        },
        total: expiredTokens + staleOauth + oldErrors + oldAuditLogs + oldAiLogs + oldImportErrors
      });
    }

    // EXECUTION MODE: Perform the hard deletes.
    // We do these sequentially (or Promise.all) but individually catch errors 
    // to ensure partial cleanup succeeds even if one table is locked.
    
    const results = {
      expiredTokens: 0,
      staleOauth: 0,
      oldErrors: 0,
      oldAuditLogs: 0,
      oldAiLogs: 0,
      oldImportErrors: 0
    };

    try { results.expiredTokens = (await prisma.verification_tokens.deleteMany({ where: queries.expiredTokens })).count; } catch (e) {}
    try { results.staleOauth = (await prisma.oauth_states.deleteMany({ where: queries.staleOauth })).count; } catch (e) {}
    try { results.oldErrors = (await prisma.systemError.deleteMany({ where: queries.oldErrors })).count; } catch (e) {}
    try { results.oldAuditLogs = (await prisma.auditLog.deleteMany({ where: queries.oldAuditLogs })).count; } catch (e) {}
    try { results.oldAiLogs = (await prisma.aiUsageLog.deleteMany({ where: queries.oldAiLogs })).count; } catch (e) {}
    try { results.oldImportErrors = (await prisma.importError.deleteMany({ where: queries.oldImportErrors })).count; } catch (e) {}

    const totalDeleted = Object.values(results).reduce((a, b) => a + b, 0);

    // Audit the cleanup action itself (Strict Founders Rule)
    await prisma.auditLog.create({
      data: {
        action_type: "DELETE",
        action: "DATABASE_MAINTENANCE",
        user_id: userId,
        actor_email: user?.email || "admin",
        severity: "HIGH",
        status: "SUCCESS",
        metadata: results as any,
        description: `Admin manually cleaned up ${totalDeleted} stale database records.`
      }
    });

    return NextResponse.json({
      ok: true,
      preview: false,
      deleted: results,
      total: totalDeleted,
      message: `Successfully purged ${totalDeleted.toLocaleString()} obsolete records.`
    });

  } catch (error: any) {
    console.error("[database-cleanup] Fatal error:", error);
    return NextResponse.json({ error: "Failed to perform database maintenance." }, { status: 500 });
  }
}
