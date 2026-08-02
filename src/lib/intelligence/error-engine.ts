import prisma from "@/lib/prisma";

export type RawErrorContext = {
  service: "gmail" | "database" | "scheduler" | "ai" | "system";
  originalError: any;
  contextMessage?: string;
  impactSize?: number; // e.g., number of emails delayed
};

type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface ParsedIncident {
  errorType: string;
  message: string;
  severity: Severity;
  impact: string;
  recommendation: string;
}

/**
 * Intelligent Error Engine
 * Converts technical stack traces and raw errors into business-level incidents.
 */
export async function reportSystemError(ctx: RawErrorContext) {
  const incident = interpretError(ctx);

  // Grouping by finding an unresolved error of the same type and service
  const existing = await prisma.systemError.findFirst({
    where: {
      service: ctx.service,
      errorType: incident.errorType,
      resolved: false,
    },
  });

  if (existing) {
    // Update frequency tracking
    return await prisma.systemError.update({
      where: { id: existing.id },
      data: {
        count: { increment: 1 },
        lastSeen: new Date(),
        // Potentially escalate severity if count is very high (e.g., > 100)
        severity: existing.count > 100 ? "CRITICAL" : existing.severity,
      },
    });
  }

  // Create new incident
  return await prisma.systemError.create({
    data: {
      service: ctx.service,
      errorType: incident.errorType,
      severity: incident.severity,
      message: incident.message,
      impact: incident.impact,
      recommendation: incident.recommendation,
    },
  });
}

function interpretError(ctx: RawErrorContext): ParsedIncident {
  const rawMsg = ctx.originalError?.message || String(ctx.originalError);
  
  // Rule: Gmail Rate Limit
  if (ctx.service === "gmail" && (rawMsg.includes("429") || rawMsg.includes("rate limit") || rawMsg.includes("quota"))) {
    return {
      errorType: "GMAIL_RATE_LIMIT",
      message: "Gmail sending limit reached or quota exceeded.",
      severity: "HIGH",
      impact: ctx.impactSize ? `${ctx.impactSize} emails delayed` : "Email sending temporarily halted",
      recommendation: "Reduce sending speed or increase warmup capacity.",
    };
  }

  // Rule: Gmail Auth Failure
  if (ctx.service === "gmail" && (rawMsg.includes("401") || rawMsg.includes("invalid_grant") || rawMsg.includes("unauthorized"))) {
    return {
      errorType: "GMAIL_AUTH_FAILED",
      message: "Gmail authentication failed (invalid or expired token).",
      severity: "CRITICAL",
      impact: "All outbound emails blocked.",
      recommendation: "Operator must reconnect Gmail via the OAuth dashboard immediately.",
    };
  }

  // Rule: Database Connection
  if (ctx.service === "database" && (rawMsg.includes("P1001") || rawMsg.includes("ECONNREFUSED"))) {
    return {
      errorType: "DB_CONNECTION_REFUSED",
      message: "Cannot connect to the Supabase database pooler.",
      severity: "CRITICAL",
      impact: "System is completely degraded.",
      recommendation: "Check database status in Supabase dashboard. Verify connection pooler limits.",
    };
  }

  // Default Fallback
  return {
    errorType: "UNKNOWN_ERROR",
    message: ctx.contextMessage || "An unexpected error occurred.",
    severity: "MEDIUM",
    impact: ctx.impactSize ? `${ctx.impactSize} operations affected` : "Unknown impact.",
    recommendation: "Inspect detailed logs and system traces.",
  };
}

/**
 * Resolve an error manually or automatically
 */
export async function resolveSystemError(id: string) {
  return await prisma.systemError.update({
    where: { id },
    data: { resolved: true },
  });
}
