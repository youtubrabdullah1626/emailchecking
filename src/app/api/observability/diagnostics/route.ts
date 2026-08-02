import { NextRequest, NextResponse } from "next/server";
import { healthMonitor } from "@/lib/observability/health";
import prisma from "@/lib/prisma";
import { verifyAdminSecret, unauthorizedResponse } from "@/lib/auth/admin-auth";

// Cache this endpoint for 15 seconds to prevent database overload from dashboard polling
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = verifyAdminSecret(request);
  if (!auth.authorized) return unauthorizedResponse(auth.reason);
  try {
    const health = await healthMonitor.getSystemHealth();
    
    // Diagnostics aggregations
    const activeAccounts = await prisma.emailAccount.count({ where: { connection_status: "CONNECTED" }});
    const pendingJobs = await prisma.sequenceStep.count({ where: { status: "PENDING" }});
    
    // Most recent events
    const lastSend = await prisma.emailEvent.findFirst({
      where: { event_type: "SENT" },
      orderBy: { occurred_at: "desc" },
    });
    
    const lastReply = await prisma.replyClassification.findFirst({
      orderBy: { classified_at: "desc" },
    });

    // In a real system we'd track scheduler runs in the audit log
    const lastSchedulerRun = await prisma.auditLog.findFirst({
      where: { action: "Scheduler Run Completed" },
      orderBy: { created_at: "desc" },
    });

    return NextResponse.json({
      health,
      diagnostics: {
        activeGmailAccounts: activeAccounts,
        pendingJobs,
        lastSuccessfulSend: lastSend?.occurred_at || null,
        lastReplyScan: lastReply?.classified_at || null,
        lastSchedulerExecution: lastSchedulerRun?.created_at || null,
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to retrieve diagnostics" },
      { status: 500 }
    );
  }
}
