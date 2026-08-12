import prisma from "@/lib/prisma";
import { AuditLog, Prisma } from "@prisma/client";

export interface AuditLogFilters {
  search?: string;
  category?: string;
  status?: string;
  severity?: string;
  time?: string;
  actorId?: string;
  resourceId?: string;
  startDate?: Date;
  endDate?: Date;
}

export class AuditRepository {
  /**
   * Fetch paginated audit logs using cursor pagination.
   * CUIDs are sequential, so ordering by ID descending provides stable chronological sorting.
   */
  async getAuditLogs(filters: AuditLogFilters, limit: number, cursor?: string): Promise<{ logs: AuditLog[], nextCursor?: string }> {
    const where = this.buildWhereClause(filters);

    const logs = await prisma.auditLog.findMany({
      where,
      take: limit + 1, // Fetch one extra to determine if there's a next page
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { id: "desc" }, // CUIDs are chronologically sortable
    });

    let nextCursor: string | undefined = undefined;
    if (logs.length > limit) {
      const nextItem = logs.pop(); // Remove the extra item
      nextCursor = nextItem!.id;
    }

    return { logs, nextCursor };
  }

  /**
   * Fetches a single audit log by its ID.
   */
  async getAuditLogById(id: string): Promise<AuditLog | null> {
    return prisma.auditLog.findUnique({
      where: { id }
    });
  }

  /**
   * Fetches all related events sharing the same correlation ID to reconstruct a workflow.
   */
  async getRelatedEvents(correlationId: string): Promise<AuditLog[]> {
    if (!correlationId) return [];
    
    return prisma.auditLog.findMany({
      where: { correlation_id: correlationId },
      orderBy: { created_at: "asc" }, // Ascending for timeline view
      take: 100 // Prevent unbounded queries
    });
  }

  /**
   * Fetches real-time metrics based on the current filters.
   */
  async getAuditStats(filters: AuditLogFilters) {
    const where = this.buildWhereClause(filters);
    
    const [total, successCount, warningCount, criticalCount] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.count({ where: { ...where, status: "SUCCESS", severity: "INFO" } }),
      prisma.auditLog.count({ where: { ...where, severity: "WARNING" } }),
      prisma.auditLog.count({ where: { ...where, severity: "CRITICAL" } })
    ]);

    return { total, successCount, warningCount, criticalCount };
  }

  /**
   * Appends an immutable audit log to the database.
   * This is the ONLY mutation method exposed. Audit logs cannot be updated or deleted.
   */
  async logEvent(data: Omit<Prisma.AuditLogCreateInput, "id" | "created_at">): Promise<AuditLog> {
    return prisma.auditLog.create({
      data
    });
  }

  /**
   * Deletes audit logs older than the specified date.
   */
  async deleteLogsOlderThan(date: Date): Promise<number> {
    const result = await prisma.auditLog.deleteMany({
      where: {
        created_at: {
          lt: date
        }
      }
    });
    return result.count;
  }

  /**
   * Helper to build Prisma where clauses from domain filters.
   */
  private buildWhereClause(filters: AuditLogFilters): Prisma.AuditLogWhereInput {
    const where: Prisma.AuditLogWhereInput = {};

    if (filters.search) {
      // Indexed text search (case-insensitive)
      const q = filters.search;
      where.OR = [
        { action: { contains: q, mode: "insensitive" } },
        { actor_email: { contains: q, mode: "insensitive" } },
        { resource_id: { equals: q } }, // exact match for IDs
        { correlation_id: { equals: q } }
      ];
    }

    if (filters.category) {
      where.category = filters.category as any;
    }

    if (filters.status) {
      where.status = filters.status as any;
    }

    if (filters.actorId) {
      where.actor_id = filters.actorId;
    }

    if (filters.resourceId) {
      where.resource_id = filters.resourceId;
    }

    if (filters.severity) {
      where.severity = filters.severity as any;
    }

    if (filters.time) {
      const now = new Date();
      where.created_at = {};
      if (filters.time === "24h") {
        where.created_at.gte = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      } else if (filters.time === "7d") {
        where.created_at.gte = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      }
    } else if (filters.startDate || filters.endDate) {
      where.created_at = {};
      if (filters.startDate) where.created_at.gte = filters.startDate;
      if (filters.endDate) where.created_at.lte = filters.endDate;
    }

    return where;
  }
}
