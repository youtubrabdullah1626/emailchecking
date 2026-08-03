import { IImportService, ImportRecord, ImportSummary, ParsedFileResult } from "./ImportService";
import { FileParser } from "./parsers/FileParser";
import { ImportMapper } from "./mappers/ImportMapper";
import { ImportValidator } from "./validators/ImportValidator";
import { MappingEngine } from "./engines/MappingEngine";

/**
 * Real implementation of IImportService.
 * Coordinates parsing, mapping, and validating strictly in the client.
 */
export class RealImportService implements IImportService {
  private fileParser = new FileParser();
  private mapper = new ImportMapper();
  private validator = new ImportValidator();
  private mappingEngine = new MappingEngine();

  async parseFile(file: File): Promise<ParsedFileResult> {
    let rawRows = await this.fileParser.parse(file);
    if (!rawRows || rawRows.length === 0) {
      throw new Error("File is empty or could not be parsed.");
    }

    // Vertical Format Detection & Transposition
    // If the file is a vertical key-value list (e.g. Field | Lead 1 | Lead 2), transpose it automatically.
    if (rawRows.length > 0) {
      const keys = Object.keys(rawRows[0] || {});
      if (keys.length > 1) {
        const firstKey = keys[0];
        const keyColumnValues = rawRows.slice(0, 15).map(r => String(r[firstKey] || '').toLowerCase());
        const commonHeaders = ['email', 'first name', 'last name', 'name', 'company', 'title', 'phone', 'website', 'country', 'linkedin'];
        const matchCount = keyColumnValues.filter(v => commonHeaders.some(h => v.includes(h))).length;
        
        // If the first column strongly resembles standard schema headers, we assume it's vertical.
        if (matchCount >= 2 && matchCount >= Math.min(3, rawRows.length * 0.3)) {
          const transposedRows: any[] = [];
          const valueKeys = keys.slice(1);
          
          for (const vKey of valueKeys) {
            const newRow: any = {};
            let currentHeader = "";
            for (const row of rawRows) {
              const newHeaderName = String(row[firstKey] || '').trim();
              if (newHeaderName) {
                 currentHeader = newHeaderName;
                 newRow[currentHeader] = row[vKey] || '';
              } else if (currentHeader) {
                 // Append continuation lines to the current header
                 const continuation = row[vKey] || '';
                 if (continuation) {
                   newRow[currentHeader] += "\n" + continuation;
                 }
              }
            }
            if (Object.keys(newRow).length > 0) {
              transposedRows.push(newRow);
            }
          }
          rawRows = transposedRows;
        }
      }
    }

    // Extract all unique headers from the first 100 rows to ensure we catch everything
    const headerSet = new Set<string>();
    const sample = rawRows.slice(0, 100);
    sample.forEach(row => {
      if (row && typeof row === 'object') {
        Object.keys(row).forEach(k => headerSet.add(k));
      }
    });

    return {
      headers: Array.from(headerSet),
      rawRows,
    };
  }

  generateAutoMapping(headers: string[]): Record<string, string> {
    return this.mappingEngine.generateAutoMapping(headers);
  }

  applyMapping(rawRows: any[], mapping: Record<string, string>): ImportRecord[] {
    // 2. Map raw rows into normalized ImportRecord format using the provided mapping dictionary
    // We update ImportMapper to accept the mapping dictionary
    return rawRows.map((row, idx) => this.mapper.mapRowWithConfig(row, idx, mapping));
  }

  async validateRecords(records: ImportRecord[]): Promise<{ validatedRecords: ImportRecord[]; summary: ImportSummary }> {
    // Simulate slight delay for UX
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // 3. Run full validation pipeline
    return this.validator.validate(records);
  }
}

export function getImportService(): IImportService {
  return new RealImportService();
}
