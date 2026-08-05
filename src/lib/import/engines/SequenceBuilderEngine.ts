import { ImportRecord } from "../ImportService";

export interface SequenceStep {
  id: string; // unique ID per step per lead
  stepNumber: number; // strictly continuous 1, 2, 3...
  type: "EMAIL" | "LINKEDIN" | "CALL"; // Future proofing
  subject: string; // The email subject
  content: string; // The personalized content
  delayDays: number; // Expected delay before sending
  conditions?: Record<string, any>;
}

export interface CampaignSequence {
  recordId: string;
  recipientEmail: string;
  steps: SequenceStep[];
  isValid: boolean;
  validationErrors: string[];
}

export interface SequenceSummaryData {
  totalLeads: number;
  totalEmails: number;
  averageEmailsPerLead: number;
  leadsWithNoFollowUps: number;
  leadsWith1FollowUp: number;
  leadsWith2FollowUps: number;
  leadsWith3FollowUps: number;
  skippedInvalidLeads: number;
}

export interface ISequenceBuilderStrategy {
  buildSequences(records: ImportRecord[]): {
    sequences: CampaignSequence[];
    summary: SequenceSummaryData;
  };
}

/**
 * Enterprise Sequence Builder Engine
 * O(n) performance. Pure, stateless, strictly deterministic.
 * Generates sequences and handles dynamic follow-up parsing.
 */
export class SequenceBuilderEngine implements ISequenceBuilderStrategy {
  
  private interpolateVariables(template: string, record: ImportRecord): string {
    if (!template) return "";
    let result = template;
    
    // Standard fields mapping
    const standardFields: Record<string, string | undefined> = {
      firstName: record.firstName,
      lastName: record.lastName,
      companyName: record.companyName,
      title: record.title,
      email: record.email,
      phone: record.phone,
      website: record.website,
      country: record.country,
      city: record.city,
    };

    // Replace all {{variable}} tags
    result = result.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, variableName) => {
      // First check standard fields
      if (standardFields[variableName] !== undefined) {
        return standardFields[variableName] as string;
      }
      // Then check custom fields
      if (record.customFields[variableName] !== undefined) {
        return record.customFields[variableName] as string;
      }
      // Fallback: leave as is if not found
      return match;
    });

    return result;
  }

  public buildSequences(records: ImportRecord[]): {
    sequences: CampaignSequence[];
    summary: SequenceSummaryData;
  } {
    const sequences: CampaignSequence[] = [];
    const summary: SequenceSummaryData = {
      totalLeads: 0,
      totalEmails: 0,
      averageEmailsPerLead: 0,
      leadsWithNoFollowUps: 0,
      leadsWith1FollowUp: 0,
      leadsWith2FollowUps: 0,
      leadsWith3FollowUps: 0,
      skippedInvalidLeads: 0,
    };

    for (const record of records) {
      if (!record.isValid || !record.email) {
        summary.skippedInvalidLeads++;
        continue;
      }

      // Check initial message
      let initialMessage = record.customFields["initialMessage"] || record.customFields["message"] || record.customFields["email body"];
      if (!initialMessage || initialMessage.trim() === "") {
        // Auto-generate a generic placeholder if missing so it doesn't fail silently for beginners
        initialMessage = `Hi ${record.firstName || "there"},\n\nI wanted to reach out regarding potential synergies between our companies.\n\nBest,\nSales Team`;
      }
      
      // Parse Subject dynamically
      let baseSubject = record.customFields["subject"] || record.customFields["Subject"] || `Important Outreach to ${record.companyName || record.firstName || record.email}`;

      // Interpolate the base variables
      baseSubject = this.interpolateVariables(baseSubject, record);
      initialMessage = this.interpolateVariables(initialMessage, record);

      const steps: SequenceStep[] = [];
      let stepCounter = 1;

      // Add Step 1
      steps.push({
        id: `${record.id}_step_${stepCounter}`,
        stepNumber: stepCounter,
        type: "EMAIL",
        subject: baseSubject,
        content: initialMessage,
        delayDays: 0,
      });

      // Parse follow-ups dynamically (0-3)
      // We check in order. If followUp1 exists, we add it. 
      // If a later followUp exists but an earlier one doesn't, we just append it as the NEXT step.
      const followUpKeys = ["followUp1", "followUp2", "followUp3"];
      
      for (let i = 0; i < followUpKeys.length; i++) {
        const key = followUpKeys[i];
        const content = record.customFields[key];
        
        if (content && content.trim() !== "") {
          const interpolatedContent = this.interpolateVariables(content, record);
          stepCounter++;
          steps.push({
            id: `${record.id}_step_${stepCounter}`,
            stepNumber: stepCounter,
            type: "EMAIL",
            subject: `Re: ${baseSubject}`,
            content: interpolatedContent,
            delayDays: 3, // Defaulting to 3 days for dynamic follow-ups
          });
        }
      }

      // Update Aggregates
      summary.totalLeads++;
      summary.totalEmails += steps.length;
      
      const followUpCount = steps.length - 1;
      if (followUpCount === 0) summary.leadsWithNoFollowUps++;
      else if (followUpCount === 1) summary.leadsWith1FollowUp++;
      else if (followUpCount === 2) summary.leadsWith2FollowUps++;
      else if (followUpCount >= 3) summary.leadsWith3FollowUps++; // >= 3 to cover any future extension

      sequences.push({
        recordId: record.id,
        recipientEmail: record.email,
        steps: steps,
        isValid: true,
        validationErrors: [],
      });
    }

    if (summary.totalLeads > 0) {
      summary.averageEmailsPerLead = Number((summary.totalEmails / summary.totalLeads).toFixed(2));
    }

    return { sequences, summary };
  }
}
