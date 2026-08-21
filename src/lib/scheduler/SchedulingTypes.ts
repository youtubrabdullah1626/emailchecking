import { SequenceStep } from "@/lib/import/engines/SequenceBuilderEngine";

export interface ExecutionQueueItem {
  queueId: string;
  campaignId: string;
  recordId: string;
  recipientEmail: string;
  senderEmail?: string;
  sequenceStep: SequenceStep;
  scheduledDate: string; // YYYY-MM-DD (in campaign timezone)
  scheduledTime: string; // HH:MM (in campaign timezone)
  scheduledTimestamp: number; // UTC unix timestamp for exact deterministic ordering
  timezone: string;
  priority: number;
  liveStatus?: "SCHEDULED" | "SENT" | "OPENED" | "REPLIED" | "BOUNCED" | "PROCESSING";
  lastEventTime?: string;
  isNew?: boolean;
}

export interface QueueSummary {
  totalItems: number;
  totalDays: number;
  startDate: string;
  endDate: string;
  itemsPerDay: Record<string, number>;
  warmupLimitsHit: string[];
  existingQueueMetrics?: {
    skippedDuplicates: number;
    totalExistingScheduled: number;
  };
}

export interface ScheduleValidationResult {
  isValid: boolean;
  errors: string[];
}
