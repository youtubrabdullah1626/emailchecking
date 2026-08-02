import { ImportRecord } from "@/lib/import/ImportService";
import { CampaignSequence } from "@/lib/import/engines/SequenceBuilderEngine";
import { ExecutionQueueItem } from "@/lib/scheduler/SchedulingTypes";

export type DiagnosticSeverity = "Info" | "Warning" | "Error" | "Critical";

export interface DiagnosticIssue {
  id: string;
  severity: DiagnosticSeverity;
  component: string;
  description: string;
  rootCause: string;
  recoveryRecommendation: string;
}

export class DiagnosticsEngine {
  public runDiagnostics(
    mappingConfig: Record<string, string>,
    records: ImportRecord[],
    sequences: CampaignSequence[],
    queue: ExecutionQueueItem[]
  ): DiagnosticIssue[] {
    const issues: DiagnosticIssue[] = [];

    // 1. Mapping Integrity
    const mappedFields = Object.values(mappingConfig);
    if (!mappedFields.includes("email")) {
      issues.push({
        id: "diag_map_email_missing",
        severity: "Critical",
        component: "MappingEngine",
        description: "Required field 'Email' is not mapped.",
        rootCause: "User unmapped the email column or auto-map failed.",
        recoveryRecommendation: "Go back and select an Email column."
      });
    }

    // 2. Validation Integrity
    if (records.length > 0) {
      // Only check records that the system considered "valid" but somehow missed an email
      const validRecords = records.filter(r => r.isValid);
      const missingEmails = validRecords.filter(r => !r.email || r.email.trim() === "");
      if (missingEmails.length > 0) {
        issues.push({
          id: "diag_val_empty_emails",
          severity: "Error",
          component: "Data Check",
          description: `${missingEmails.length} valid records are missing an email address.`,
          rootCause: "Data might be missing from your file.",
          recoveryRecommendation: "Review your file and re-upload."
        });
      }
      
      const invalidRecords = records.filter(r => !r.isValid);
      if (invalidRecords.length > 0) {
        issues.push({
          id: "diag_val_skipped",
          severity: "Info",
          component: "Data Check",
          description: `${invalidRecords.length} records were skipped because of missing or invalid data.`,
          rootCause: "Rows in your spreadsheet were incomplete.",
          recoveryRecommendation: "None needed. The system safely excluded them from the campaign."
        });
      }
    }

    // 3. Sequence Integrity
    if (sequences.length > 0) {
      const orphans = sequences.filter(s => s.steps.length === 0);
      if (orphans.length > 0) {
        issues.push({
          id: "diag_seq_orphans",
          severity: "Warning",
          component: "Campaign Builder",
          description: `${orphans.length} sequences generated 0 emails.`,
          rootCause: "Lead was suppressed or no email templates matched.",
          recoveryRecommendation: "Check your templates or suppression lists."
        });
      }
    }

    // 4. Queue Integrity (Duplicate Check)
    if (queue.length > 0) {
      const queueIds = new Set<string>();
      let duplicates = 0;
      for (const item of queue) {
        if (queueIds.has(item.queueId)) {
          duplicates++;
        }
        queueIds.add(item.queueId);
      }
      
      if (duplicates > 0) {
        issues.push({
          id: "diag_queue_duplicates",
          severity: "Critical",
          component: "Scheduler",
          description: `Found ${duplicates} duplicate scheduled emails.`,
          rootCause: "A system glitch caused duplicate scheduling.",
          recoveryRecommendation: "Please try clicking the compile button again."
        });
      }
    }

    return issues;
  }
}
