import { ImportRecord } from "../ImportService";

/**
 * Isolated duplicate detection logic.
 * Cross-checks records within the current import batch.
 */
export function detectDuplicates(records: ImportRecord[]): ImportRecord[] {
  const seenEmails = new Set<string>();

  return records.map((record) => {
    const emailLower = record.email.toLowerCase().trim();
    if (seenEmails.has(emailLower)) {
      return {
        ...record,
        isDuplicate: true,
        errors: [...record.errors, "Duplicate email in import file"],
      };
    }
    seenEmails.add(emailLower);
    return record;
  });
}
