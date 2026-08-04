import { DeliverabilityDecision } from "../deliverability/engine";

export type EmailProvider = 'gmail' | 'google_workspace' | 'outlook' | 'microsoft365' | 'yahoo' | 'apple_mail' | 'other';

export interface TrackingConfig {
  readonly baseUrl: string;
  readonly trackingId: string;
  readonly existingMessageId?: string; // Respect Message-ID Ownership
  readonly targetProvider: EmailProvider; // For rendering-specific formatting
  
  // Optional Metadata required for RFC header generation
  readonly unsubscribeUrl?: string; 
  readonly unsubscribeEmail?: string;
  readonly senderDomain?: string; 
}

export interface TrackingMetadata {
  readonly headers: Readonly<Record<string, string>>;
  readonly pixelHtml: string;
}

export class TrackingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TrackingValidationError';
  }
}
