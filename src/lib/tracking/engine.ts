import { TrackingConfig, TrackingMetadata, TrackingValidationError } from "./types";
import { DeliverabilityDecision } from "../deliverability/engine";
import crypto from 'crypto';

function validateConfig(config: TrackingConfig): void {
  if (!config.baseUrl) throw new TrackingValidationError("baseUrl is required");
  if (!config.trackingId) throw new TrackingValidationError("trackingId is required");
}

function generateMessageId(domain: string = 'localhost'): string {
  const randomBytes = crypto.randomBytes(16).toString('hex');
  const timestamp = Date.now();
  return `<${timestamp}.${randomBytes}@${domain}>`;
}

function generateHeaders(decision: DeliverabilityDecision, config: TrackingConfig): Record<string, string> {
  const headers: Record<string, string> = {};

  // 1. Message-ID Ownership (Rule: Never overwrite an existing valid Message-ID)
  if (config.existingMessageId) {
    headers['Message-ID'] = config.existingMessageId;
  } else {
    headers['Message-ID'] = generateMessageId(config.senderDomain);
  }

  // 2. Consume Deliverability Decision (Single Source of Truth)
  // We NEVER decide if List-Unsubscribe should exist; Phase 1 decides. We only render.
  if (decision.listUnsubscribeEnabled) {
    const unsubLinks = [];
    if (config.unsubscribeUrl) unsubLinks.push(`<${config.unsubscribeUrl}>`);
    if (config.unsubscribeEmail) unsubLinks.push(`<mailto:${config.unsubscribeEmail}>`);
    
    if (unsubLinks.length > 0) {
      // RFC 2369 Compliant formatting
      headers['List-Unsubscribe'] = unsubLinks.join(', ');
      // RFC 8058 One-Click Unsubscribe
      headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
    }
  }

  return headers;
}

function generatePixel(decision: DeliverabilityDecision, config: TrackingConfig): string {
  // If Phase 1 Deliverability disabled tracking, strictly enforce it.
  if (!decision.trackingPixelEnabled) {
    return "";
  }
  
  // Gmail aggressively flags localhost image links as spam/phishing. 
  // Safety rule: never generate pixels for local environments.
  if (config.baseUrl.includes("localhost") || config.baseUrl.includes("127.0.0.1")) {
    return "";
  }

  const pixelUrl = `${config.baseUrl}/api/track/${config.trackingId}`;
  
  // Exact 1x1 invisible rendering pixel, strict MIME and HTML compliance.
  return `<img src="${pixelUrl}" width="1" height="1" alt="" style="display:none; visibility:hidden; width:1px; height:1px;" />`;
}

/**
 * Pure metadata generation engine.
 * Receives decisions and configs, returns immutable rendering instructions.
 * Strictly forbidden from Database access, API calls, or MIME boundary manipulation.
 */
export function generateTrackingMetadata(
  decision: DeliverabilityDecision,
  config: TrackingConfig
): TrackingMetadata {
  validateConfig(config);

  const headers = generateHeaders(decision, config);
  const pixelHtml = generatePixel(decision, config);

  return Object.freeze({
    headers: Object.freeze(headers),
    pixelHtml
  });
}
