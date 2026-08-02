import prisma from "@/lib/prisma";
import { logger } from "./logger";

export class RetentionService {
  /**
   * Cleans up AuditLog and SystemError tables based on retention policy.
   * Defaults to 30 days.
   */
  public async cleanup(daysToKeep: number = 30): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    logger.info(`Starting retention cleanup. Removing logs older than ${daysToKeep} days`, { cutoffDate });

    try {
      const { count: auditCount } = await prisma.auditLog.deleteMany({
        where: {
          created_at: { lt: cutoffDate }
        }
      });

      const { count: errorCount } = await prisma.systemError.deleteMany({
        where: {
          lastSeen: { lt: cutoffDate },
          resolved: true // Only delete resolved errors, or maybe all old errors? Let's delete all to prevent unbounded growth.
        }
      });
      
      // Also delete unresolved errors if they are extremely old to prevent indefinite growth
      const { count: unresolvedErrorCount } = await prisma.systemError.deleteMany({
        where: {
          lastSeen: { lt: cutoffDate }
        }
      });

      logger.info("Retention cleanup complete", {
        auditRecordsDeleted: auditCount,
        errorRecordsDeleted: errorCount + unresolvedErrorCount
      });
    } catch (error) {
      logger.error("Failed to run retention cleanup", { error });
    }
  }
}

export const retention = new RetentionService();
