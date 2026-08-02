import prisma from "@/lib/prisma";
import { requestContext, logger } from "./logger";
import { AuditActionType } from "@prisma/client";

export interface AuditEventInput {
  actionType: AuditActionType;
  action: string;
  userId?: string;
  prospectId?: string;
  sequenceId?: string;
  metadata?: Record<string, any>;
}

export class AuditService {
  /**
   * Log a business event to the immutable audit log.
   */
  public async logEvent(input: AuditEventInput): Promise<void> {
    try {
      const context = requestContext.getStore();
      const requestId = context?.requestId;

      // Enhance metadata with correlation ID
      const metadata = {
        ...input.metadata,
        requestId,
      };

      await prisma.auditLog.create({
        data: {
          action_type: input.actionType,
          action: input.action,
          user_id: input.userId,
          prospect_id: input.prospectId,
          sequence_id: input.sequenceId,
          metadata,
        },
      });

      // Also echo to standard logger for immediate visibility
      logger.info(`Audit: ${input.action}`, { 
        module: "AuditService",
        ...metadata,
        actionType: input.actionType,
        prospectId: input.prospectId,
        sequenceId: input.sequenceId
      });
    } catch (error) {
      // Don't throw audit errors to prevent breaking business logic, just log critically
      logger.error("Failed to write to AuditLog", { error, input });
    }
  }
}

export const audit = new AuditService();
