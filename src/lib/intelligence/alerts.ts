import { SystemErrorSeverity } from "@prisma/client";

export interface AlertEvent {
  title: string;
  description: string;
  severity: SystemErrorSeverity;
  service: string;
  metadata?: Record<string, any>;
}

/**
 * Intelligent Alert Engine
 * Evaluates business events and determines if external routing (Slack, Discord, Email) is necessary.
 */
export async function dispatchAlert(event: AlertEvent) {
  // 1. Severity Decision
  const shouldAlert = event.severity === "CRITICAL" || event.severity === "HIGH";

  if (!shouldAlert) {
    // Just log warnings/low severity silently
    console.log(`[ALERT:SKIPPED] [${event.severity}] ${event.title}`);
    return;
  }

  // 2. Dispatch to Transports
  await routeToTransports(event);
}

/**
 * Routes the alert to configured integrations.
 * Ready for Discord/Slack webhook integration.
 */
async function routeToTransports(event: AlertEvent) {
  const payload = {
    embeds: [
      {
        title: `🚨 ${event.title}`,
        description: event.description,
        color: event.severity === "CRITICAL" ? 0xff0000 : 0xffa500,
        fields: [
          { name: "Service", value: event.service, inline: true },
          { name: "Severity", value: event.severity, inline: true },
        ],
        timestamp: new Date().toISOString(),
      },
    ],
  };

  // Structured log dispatch (Log-based alerting systems will pick this up)
  console.error(JSON.stringify({
    type: "SYSTEM_ALERT_DISPATCH",
    ...payload
  }));

  // Future: Real webhook dispatch
  // if (process.env.DISCORD_WEBHOOK_URL) {
  //   await fetch(process.env.DISCORD_WEBHOOK_URL, {
  //     method: "POST",
  //     headers: { "Content-Type": "application/json" },
  //     body: JSON.stringify(payload)
  //   });
  // }
}
