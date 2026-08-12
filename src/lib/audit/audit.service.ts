import { AuditRepository, AuditLogFilters } from "./audit.repository";
import { sanitizeData } from "./sanitizer";
import { requireAdminRole, SessionUser } from "./rbac";
import { AuditLog } from "@prisma/client";

export class AuditService {
  private repository: AuditRepository;

  constructor() {
    this.repository = new AuditRepository();
  }

  /**
   * Fetches paginated logs securely.
   * Enforces RBAC and Sanitization.
   */
  async fetchPaginatedLogs(
    user: SessionUser | null, 
    filters: AuditLogFilters, 
    limit: number = 50, 
    cursor?: string
  ) {
    // 1. Enforce RBAC
    requireAdminRole(user);

    // 2. Fetch from DB
    // Limit to max 100 to prevent large payloads
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const { logs, nextCursor } = await this.repository.getAuditLogs(filters, safeLimit, cursor);

    // 3. Fetch Real-time Stats
    const stats = await this.repository.getAuditStats(filters);

    // 4. Sanitize data before returning
    const sanitizedLogs = logs.map(this.sanitizeEvent);

    return {
      data: sanitizedLogs,
      stats,
      pagination: { nextCursor, limit: safeLimit },
      filters,
    };
  }

  /**
   * Fetches detailed information for a single event, including related correlation events.
   */
  async fetchLogDetails(user: SessionUser | null, id: string) {
    requireAdminRole(user);

    const event = await this.repository.getAuditLogById(id);
    if (!event) return null;

    let relatedEvents: AuditLog[] = [];
    if (event.correlation_id) {
      relatedEvents = await this.repository.getRelatedEvents(event.correlation_id);
    }

    return {
      event: this.sanitizeEvent(event),
      relatedEvents: relatedEvents.map(this.sanitizeEvent),
    };
  }

  /**
   * Clears old logs manually or via cron.
   * If a date is provided, deletes logs older than that date.
   * If not, deletes everything (manual hard reset).
   */
  async clearOldLogs(user: SessionUser | null, olderThan?: Date, isSystem: boolean = false) {
    if (!isSystem) {
      requireAdminRole(user);
    }
    const targetDate = olderThan || new Date();
    const count = await this.repository.deleteLogsOlderThan(targetDate);

    // Let's create an audit log saying that logs were cleared (ironically)
    await this.logAction(
      user?.id || 'system',
      user?.email || 'system@internal',
      'Cleared Audit Logs',
      'SYSTEM',
      olderThan ? `Older than ${olderThan.toISOString()}` : 'All logs',
      'AuditLog',
      'SUCCESS'
    );

    return count;
  }

  /**
   * Generates a risk classification based on business rules.
   */
  private classifyRisk(event: AuditLog): "Low" | "Medium" | "High" | "Critical" {
    if (event.status === "FAILURE" && event.severity === "CRITICAL") return "Critical";
    if (event.category === "AUTHENTICATION" || event.category === "BILLING") return "High";
    if (event.action.toLowerCase().includes("delete")) return "Medium";
    return "Low";
  }

  /**
   * Applies sanitation to prevent leaks of passwords, tokens, etc.
   * Also computes the runtime risk level.
   */
  private sanitizeEvent = (event: AuditLog) => {
    return {
      ...event,
      metadata: sanitizeData(event.metadata),
      old_values: sanitizeData(event.old_values),
      new_values: sanitizeData(event.new_values),
      riskLevel: this.classifyRisk(event),
    };
  };

  private computeSeverity(action: string, category: string, status: string): "CRITICAL" | "WARNING" | "INFO" {
    if (status === "FAILURE") return "CRITICAL";
    if (category === "AUTHENTICATION" || category === "BILLING" || category === "SECURITY") return "WARNING";
    if (action.toLowerCase().includes("delete")) return "WARNING";
    if (action.toLowerCase().includes("export") || action.toLowerCase().includes("import")) return "WARNING";
    return "INFO";
  }

  /**
   * Fast, non-blocking logger for system actions.
   * This is a fire-and-forget mechanism to ensure logging NEVER hangs or crashes the main request.
   */
  logAction(
    actorId: string,
    actorEmail: string,
    action: string,
    category: any, // ActionCategory string
    resourceName: string,
    resourceType: string,
    status: "SUCCESS" | "FAILURE" = "SUCCESS",
    details: {
      resourceId?: string;
      ipAddress?: string;
      deviceInfo?: string;
      metadata?: any;
      oldValues?: any;
      newValues?: any;
      severity?: "CRITICAL" | "WARNING" | "INFO";
    } = {}
  ) {
    // Fire-and-forget promise to prevent blocking the HTTP response
    Promise.resolve().then(async () => {
      try {
        const severity = details.severity || this.computeSeverity(action, category, status);
        
        await this.repository.logEvent({
          actor_id: actorId || 'system',
          actor_email: actorEmail || 'system@internal',
          action: action,
          category: category,
          resource_id: details.resourceId || null,
          target_resource: resourceType,
          status: status,
          severity: severity,
          ip_address: details.ipAddress || undefined,
          user_agent: details.deviceInfo || undefined,
          session_id: undefined,
          correlation_id: undefined,
          old_values: details.oldValues ? JSON.parse(JSON.stringify(details.oldValues)) : undefined,
          new_values: details.newValues ? JSON.parse(JSON.stringify(details.newValues)) : undefined,
          metadata: { ...details.metadata, resourceName, riskLevel: severity },
        });
      } catch (error) {
        // Silently catch audit log failures so they don't bring down the production app
        console.error("[AuditService] Failed to persist audit log asynchronously:", error);
      }
    });
  }
}

// Export singleton
export const auditService = new AuditService();
