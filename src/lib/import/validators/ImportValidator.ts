import { ImportRecord, ImportSummary } from "../ImportService";
import { isValidEmail } from "./EmailValidator";
import { detectDuplicates } from "./DuplicateDetector";

/**
 * Orchestrates the validation pipeline.
 */
export class ImportValidator {
  public validate(records: ImportRecord[]): { validatedRecords: ImportRecord[]; summary: ImportSummary } {
    let validRows = 0;
    let invalidRows = 0;
    let duplicateRows = 0;
    let totalWarnings = 0;

    // Filter out completely empty rows first
    const nonEmptyRecords = records.filter(record => 
      record.email || record.firstName || record.lastName || record.companyName || Object.keys(record.customFields).length > 0
    );

    // 1. Base field validation
    let validated = nonEmptyRecords.map((record) => {
      const errors: string[] = [];
      const warnings: string[] = [];

      if (!record.email) {
        errors.push("Missing required field: Email");
      } else if (!isValidEmail(record.email)) {
        errors.push("Invalid email format");
      }

      if (!record.firstName && !record.lastName) {
        warnings.push("Missing First/Last Name");
      }

      return {
        ...record,
        errors,
        warnings,
      };
    });

    // 2. Cross-record validation (Duplicates)
    validated = detectDuplicates(validated);

    // 3. Compute Summary
    validated = validated.map((record) => {
      const isInvalid = record.errors.length > 0;
      
      if (record.isDuplicate) duplicateRows++;
      else if (isInvalid) invalidRows++;
      else validRows++;

      if (record.warnings.length > 0) totalWarnings++;

      return {
        ...record,
        isValid: !isInvalid,
      };
    });

    return {
      validatedRecords: validated,
      summary: {
        totalRows: validated.length, // Only counting non-empty rows
        validRows,
        invalidRows,
        duplicateRows,
        warnings: totalWarnings,
      }
    };
  }
}
