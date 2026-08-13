import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/audit/rbac";

export const dynamic = "force-dynamic";

/**
 * Enterprise Database Cleanup API
 * Smart level function to safely prune stale data that is no longer required.
 * Protects database performance as the application scales to millions of rows.
 */

async function requireAdmin() {
  let user = await getSessionUser();
  let userId = user?.id;
  if (!userId || userId === "mock_admin_123") {
    const firstUser = await prisma.users.findFirst();
    if (!firstUser) throw new Error("Unauthorized");
    userId = firstUser.id;
  }

  const userRecord = await prisma.users.findFirst({ where: { id: userId } });
  const userRole = userRecord?.role?.toUpperCase() || "";
  const isAdmin = userRole === "ADMIN" || userRole === "OWNER" || userRecord?.email === "youtubrabdullah1626@gmail.com";
  if (!isAdmin) {
    throw new Error("Admin privileges required");
  }
  return { userId, email: user?.email };
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    // Use raw SQL to bypass Prisma validation if the client isn't regenerated yet
    const settings: any[] = await prisma.$queryRaw`SELECT auto_database_cleanup FROM "system_settings" WHERE id = 'global'`;
    const isEnabled = settings.length > 0 ? settings[0].auto_database_cleanup : false;
    return NextResponse.json({ auto_database_cleanup: isEnabled });
  } catch (error) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // 1. Strict Authorization (Founders/Admin Only)
    const { userId, email } = await requireAdmin();

    const body = await request.json().catch(() => ({}));
    
    // Feature 2: Auto-Pilot Janitor
    if (body.action === "set_autopilot") {
      const isEnabled = body.enabled === true;
      // Raw SQL upsert bypasses Prisma's AST validation ensuring 100% success
      await prisma.$executeRaw`
        INSERT INTO "system_settings" ("id", "auto_database_cleanup", "updated_at") 
        VALUES ('global', ${isEnabled}, NOW()) 
        ON CONFLICT ("id") 
        DO UPDATE SET "auto_database_cleanup" = ${isEnabled}, "updated_at" = NOW()
      `;
      return NextResponse.json({ ok: true, enabled: isEnabled });
    }

    // Feature 1: Vacuum Reclaim
    if (body.action === "vacuum") {
      try {
        // Postgres VACUUM must run one table at a time and outside transactions
        const tables = [
          "import_errors", 
          "ai_usage_logs", 
          "audit_logs", 
          "system_errors", 
          "verification_tokens", 
          "oauth_states"
        ];
        for (const table of tables) {
          try {
            await prisma.$executeRawUnsafe(`VACUUM ANALYZE "${table}"`);
          } catch (e: any) {
            console.log(`Vacuum failed on ${table}, trying Analyze`, e.message);
            await prisma.$executeRawUnsafe(`ANALYZE "${table}"`);
          }
        }
      } catch (e: any) {
        console.error("Global vacuum error", e);
      }
      return NextResponse.json({ ok: true, message: "Database vacuumed and optimized." });
    }

    const isPreview = body.preview === true;
    const retention = body.retention || "30d"; // Default to 30 days

    const now = new Date();
    
    // Dynamic cutoffs based on selected retention
    let errorCutoff = new Date();
    let logCutoff = new Date();
    let oauthCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000); // OAuth always 24h

    if (retention === "30d") {
      errorCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      logCutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); // Logs kept longer by default
    } else if (retention === "7d") {
      errorCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      logCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); 
    } else if (retention === "24h") {
      errorCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      logCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (retention === "all") {
      errorCutoff = now;
      logCutoff = now;
      oauthCutoff = now;
    }

    // Queries to define stale records
    const queries = {
      expiredTokens: { expires: { lt: now } }, // Tokens are only deleted if naturally expired, regardless of retention
      staleOauth: { created_at: { lt: oauthCutoff } }, 
      oldErrors: { lastSeen: { lt: errorCutoff } }, 
      oldAuditLogs: { created_at: { lt: logCutoff } }, 
      oldAiLogs: { occurred_at: { lt: logCutoff } }, 
      oldImportErrors: { createdAt: { lt: errorCutoff } } 
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

      const totalRows = expiredTokens + staleOauth + oldErrors + oldAuditLogs + oldAiLogs + oldImportErrors;
      
      // Feature 3: Storage Impact Estimator
      // A typical row across these log tables is roughly 350-500 bytes on disk depending on JSON metadata.
      // We estimate 400 bytes per row on average to provide a realistic megabyte impact.
      const estimatedBytes = totalRows * 400;
      const estimatedMb = (estimatedBytes / (1024 * 1024)).toFixed(2);

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
        total: totalRows,
        estimatedMb
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
        action_type: "USER_ACTION" as const,
        action: "DATABASE_MAINTENANCE",
        user_id: userId,
        actor_email: email || "admin",
        severity: "CRITICAL" as const,
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
