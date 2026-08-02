import { IImportService, ImportRecord, ImportSummary, ParsedFileResult } from "./ImportService";

/**
 * Mock implementation of IImportService.
 * (Preserved for backwards compatibility testing).
 */
export class MockImportService implements IImportService {
  async parseFile(file: File): Promise<ParsedFileResult> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          headers: ["Email", "First Name", "Last Name"],
          rawRows: [
            { "Email": "john@example.com", "First Name": "John", "Last Name": "Doe" }
          ]
        });
      }, 1000);
    });
  }

  generateAutoMapping(headers: string[]): Record<string, string> {
    return {
      "Email": "email",
      "First Name": "firstName",
      "Last Name": "lastName"
    };
  }

  applyMapping(rawRows: any[], mapping: Record<string, string>): ImportRecord[] {
    return rawRows.map((row, i) => ({
      id: `mock_${i}`,
      email: row["Email"] || "",
      firstName: row["First Name"] || "",
      lastName: row["Last Name"] || "",
      customFields: {},
      isValid: true,
      errors: [],
      warnings: [],
      isDuplicate: false,
    }));
  }

  async validateRecords(records: ImportRecord[]): Promise<{ validatedRecords: ImportRecord[]; summary: ImportSummary }> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          validatedRecords: records,
          summary: {
            totalRows: records.length,
            validRows: records.length,
            invalidRows: 0,
            duplicateRows: 0,
            warnings: 0,
          },
        });
      }, 500);
    });
  }
}
