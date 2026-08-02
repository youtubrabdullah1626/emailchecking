import prisma from "@/lib/prisma";
import { logger } from "./logger";
import { SystemErrorSeverity } from "@prisma/client";

export type ErrorCategory =
  | "OAuth"
  | "Gmail"
  | "Scheduler"
  | "Database"
  | "Validation"
  | "Network"
  | "Internal";

export interface SystemErrorInput {
  service: string;
  category: ErrorCategory;
  severity: SystemErrorSeverity;
  message: string;
  error?: unknown;
  impact?: string;
  recommendation?: string;
}

export class ErrorTrackingService {
  /**
   * Tracks an error in the database for the Operations Dashboard.
   * Groups identical errors by service and message within a recent window.
   */
  public async trackError(input: SystemErrorInput): Promise<void> {
    try {
      const errorMsg = input.error instanceof Error ? input.error.message : String(input.error || "");
      const stack = input.error instanceof Error ? input.error.stack : undefined;
      const combinedMessage = errorMsg ? `${input.message}: ${errorMsg}` : input.message;

      logger.error(`[${input.category}] ${combinedMessage}`, {
        module: input.service,
        error: input.error,
        severity: input.severity,
      });

      // Simple deduplication: Try to find an unresolved error of the same type/service/message in the last hour
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      const existing = await prisma.systemError.findFirst({
        where: {
          service: input.service,
          errorType: input.category,
          message: combinedMessage,
          resolved: false,
          lastSeen: {
            gte: oneHourAgo,
          }
        },
      });

      if (existing) {
        await prisma.systemError.update({
          where: { id: existing.id },
          data: {
            count: { increment: 1 },
            lastSeen: new Date(),
          },
        });
      } else {
        await prisma.systemError.create({
          data: {
            service: input.service,
            errorType: input.category,
            severity: input.severity,
            message: combinedMessage,
            impact: input.impact || stack, // Temporarily store stack trace in impact if empty
            recommendation: input.recommendation,
          },
        });
      }
    } catch (dbError) {
      // Fallback
      logger.critical("Failed to save SystemError to database", { error: dbError });
    }
  }
}

export const errorTracker = new ErrorTrackingService();
