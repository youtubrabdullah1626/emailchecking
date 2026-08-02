/**
 * CRM Integration Layer — Adapter Pattern (Phase 4)
 *
 * Provides a clean abstraction layer for synchronizing reply tracking events
 * with external CRM providers (HubSpot, Salesforce, Pipedrive, or custom webhooks).
 *
 * Business logic remains 100% decoupled from CRM vendor APIs.
 *
 * Server-side only.
 */

export interface CrmProspectRepliedPayload {
  prospectId: string;
  prospectEmail: string;
  prospectName: string;
  company: string;
  sequenceId: string;
  gmailThreadId: string;
  gmailMessageId: string;
  replyType: string;
  rawSnippet: string | null;
  timestamp: string;
}

export interface CrmAdapterResult {
  success: boolean;
  provider: string;
  message: string;
  responseStatus?: number;
}

export interface CrmAdapter {
  providerName: string;
  onProspectReplied(payload: CrmProspectRepliedPayload): Promise<CrmAdapterResult>;
}

/**
 * Webhook CRM Adapter — Posts structured JSON events to external CRM webhook endpoint.
 * Activated when process.env.CRM_WEBHOOK_URL is set.
 */
export class WebhookCrmAdapter implements CrmAdapter {
  public readonly providerName = "WEBHOOK_CRM";

  constructor(private readonly webhookUrl: string) {}

  async onProspectReplied(payload: CrmProspectRepliedPayload): Promise<CrmAdapterResult> {
    try {
      const response = await fetch(this.webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Outreach-EmailSystem-CRM/1.0",
        },
        body: JSON.stringify({
          event: "prospect.replied",
          data: payload,
        }),
      });

      if (!response.ok) {
        return {
          success: false,
          provider: this.providerName,
          message: `CRM webhook returned HTTP ${response.status}`,
          responseStatus: response.status,
        };
      }

      return {
        success: true,
        provider: this.providerName,
        message: "Successfully synchronized reply event with external CRM webhook.",
        responseStatus: response.status,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "CRM sync network error";
      return {
        success: false,
        provider: this.providerName,
        message: `CRM webhook dispatch failed: ${msg}`,
      };
    }
  }
}

/**
 * No-Op CRM Adapter — Safely skips CRM sync when no external CRM is configured.
 */
export class NoopCrmAdapter implements CrmAdapter {
  public readonly providerName = "NOOP_CRM";

  async onProspectReplied(payload: CrmProspectRepliedPayload): Promise<CrmAdapterResult> {
    return {
      success: true,
      provider: this.providerName,
      message: `No external CRM configured for prospect ${payload.prospectEmail}. Sync safely skipped.`,
    };
  }
}

/**
 * Factory function to retrieve the active CRM adapter instance.
 */
export function getCrmAdapter(): CrmAdapter {
  const webhookUrl = process.env.CRM_WEBHOOK_URL;
  if (webhookUrl && webhookUrl.trim()) {
    return new WebhookCrmAdapter(webhookUrl.trim());
  }
  return new NoopCrmAdapter();
}
