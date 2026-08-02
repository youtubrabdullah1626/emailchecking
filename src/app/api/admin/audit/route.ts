import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyAdminSecret, unauthorizedResponse } from "@/lib/auth/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = verifyAdminSecret(request);
  if (!auth.authorized) return unauthorizedResponse(auth.reason);

  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const filter = searchParams.get("filter") || "all";
    const skip = (page - 1) * limit;

    let userLogs: any[] = [];
    let systemLogs: any[] = [];
    
    // We will do a simple pagination by fetching skip + limit from both, merging, and slicing.
    // For large scale, a UNION query is better, but Prisma lacks UNION.
    const takeAmount = skip + limit;

    const [userTotal, sysTotal] = await prisma.$transaction([
      prisma.auditLog.count(),
      prisma.emailEvent.count()
    ]);

    if (filter === "all" || filter === "USER") {
      userLogs = await prisma.auditLog.findMany({
        orderBy: { created_at: "desc" },
        take: takeAmount,
      });
    }

    if (filter === "all" || filter === "SYSTEM") {
      systemLogs = await prisma.emailEvent.findMany({
        orderBy: { occurred_at: "desc" },
        take: takeAmount,
        include: {
          step: {
            select: {
              subject: true,
              sequence: {
                select: { prospect: { select: { email: true, name: true } } }
              }
            }
          }
        }
      });
    }

    const formattedUserLogs = userLogs.map(log => ({
      id: log.id,
      time: log.created_at,
      source: "USER ACTION",
      action: log.action,
      detail: JSON.stringify(log.metadata)
    }));

    const formattedSystemLogs = systemLogs.map(log => {
      let detail = log.step?.subject || "Unknown subject";
      if (log.step?.sequence?.prospect) {
        detail = `${log.step.sequence.prospect.name} (${log.step.sequence.prospect.email}) - ${detail}`;
      }
      return {
        id: log.id,
        time: log.occurred_at,
        source: "SYSTEM",
        action: `${log.event_type} email`,
        detail
      };
    });

    const combined = [...formattedUserLogs, ...formattedSystemLogs]
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(skip, skip + limit);

    const total = filter === "all" ? (userTotal + sysTotal) : (filter === "USER" ? userTotal : sysTotal);
    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      data: combined,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1
      }
    });
  } catch (err) {
    return NextResponse.json({ error: "Failed to load audit logs" }, { status: 500 });
  }
}
