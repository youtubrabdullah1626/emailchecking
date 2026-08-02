export type ImportStatus = "IDLE" | "PARSING" | "MAPPING" | "VALIDATING" | "REVIEW" | "PLANNING" | "BUILDING" | "PREVIEW" | "SCHEDULING" | "APPROVED" | "EXECUTING" | "ERROR";

export interface ImportRecord {
  id: string; // Internal temporary ID
  email: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  title?: string;
  linkedinProfile?: string;
  phone?: string;
  website?: string;
  country?: string;
  city?: string;
  customFields: Record<string, string>;
  isValid: boolean;
  errors: string[];
  warnings: string[];
  isDuplicate: boolean;
}

export interface ImportSummary {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  warnings: number;
}

export interface ParsedFileResult {
  headers: string[];
  rawRows: any[];
}

export interface IImportService {
  parseFile(file: File): Promise<ParsedFileResult>;
  generateAutoMapping(headers: string[]): Record<string, string>;
  applyMapping(rawRows: any[], mapping: Record<string, string>): ImportRecord[];
  validateRecords(records: ImportRecord[]): Promise<{
    validatedRecords: ImportRecord[];
    summary: ImportSummary;
  }>;
}
