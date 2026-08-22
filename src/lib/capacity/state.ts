/**
 * Dynamic Capacity State & Invariant Guard — SILAER 10X
 * 
 * Resolves comprehensive account, inbox, campaign, and capacity health.
 */

import { evaluateCapacityState, CapacityStateEvaluation } from "./forecast";

export interface SystemCapacityContext {
  sentToday: number;
  dailyLimit: number;
  sentThisHour: number;
  hourlyLimit: number;
  connectedInboxesCount: number;
  inboxesList: { email: string; daily_limit: number; sent_today: number; status: string }[];
  isCampaignActive: boolean;
  userTimezone: string;
}

export interface StepDiagnosticContext {
  stepId: string;
  stepNumber: number;
  recipientEmail: string;
  scheduledAtUtc: string | Date;
  status: string;
  isOverdue: boolean;
  capacityState: CapacityStateEvaluation;
  queuePosition: number;
  totalQueued: number;
  estimatedDispatchText: string;
}

/**
 * Resolves full diagnostic data for a specific step.
 */
export function resolveStepDiagnostic(
  step: {
    id: string;
    step_number: number;
    recipientEmail?: string;
    scheduled_at_utc: string | Date;
    status: string;
  },
  systemContext: SystemCapacityContext,
  allPendingSteps: { id: string; scheduled_at_utc: string | Date }[] = []
): StepDiagnosticContext {
  const capacityState = evaluateCapacityState(
    systemContext.sentToday,
    systemContext.dailyLimit,
    systemContext.sentThisHour,
    systemContext.hourlyLimit,
    systemContext.connectedInboxesCount,
    systemContext.userTimezone
  );

  const scheduledTime = new Date(step.scheduled_at_utc).getTime();
  const now = Date.now();
  const isOverdue = scheduledTime <= now && (step.status === "PENDING" || step.status === "PROCESSING");

  const pendingList = allPendingSteps.length > 0 ? allPendingSteps : [{ id: step.id, scheduled_at_utc: step.scheduled_at_utc }];
  const sorted = [...pendingList].sort((a, b) => new Date(a.scheduled_at_utc).getTime() - new Date(b.scheduled_at_utc).getTime());
  const index = sorted.findIndex((s) => s.id === step.id);
  const queuePosition = index >= 0 ? index + 1 : 1;
  const totalQueued = sorted.length;

  let estimatedDispatchText = "Scheduled as planned";
  if (capacityState.isDailyCapReached || capacityState.isHourlyPacingActive) {
    const nextWindow = capacityState.nextWindowUtc;
    const offsetMinutes = (queuePosition - 1) * Math.max(2, Math.floor(60 / Math.max(1, systemContext.hourlyLimit)));
    const targetDate = new Date(nextWindow.getTime() + offsetMinutes * 60 * 1000);
    const isToday = new Date().toDateString() === targetDate.toDateString();
    const timeStr = targetDate.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    estimatedDispatchText = isToday ? `Today @ ${timeStr}` : `Tomorrow @ ${timeStr}`;
  }

  return {
    stepId: step.id,
    stepNumber: step.step_number,
    recipientEmail: step.recipientEmail || "lead@example.com",
    scheduledAtUtc: step.scheduled_at_utc,
    status: step.status,
    isOverdue,
    capacityState,
    queuePosition,
    totalQueued,
    estimatedDispatchText,
  };
}
