import { CsvParser } from "./CsvParser";
import { ExcelParser } from "./ExcelParser";
import { JsonParser } from "./JsonParser";
import { PdfTableParser } from "./PdfTableParser";

/**
 * Unified entry point for parsing various file formats.
 * Delegates to specific parsers based on file extension.
 */
export class FileParser {
  public async parse(file: File): Promise<any[]> {
    const ext = file.name.split('.').pop()?.toLowerCase();
    
    switch (ext) {
      case 'csv':
        return new CsvParser().parse(file);
      case 'xlsx':
      case 'xls':
      case 'ods':
        return new ExcelParser().parse(file);
      case 'json':
        return new JsonParser().parse(file);
      case 'pdf':
        return new PdfTableParser().parse(file);
      default:
        throw new Error(`Unsupported file type: ${ext}. Please use the Universal Prompt to format your data into a CSV.`);
    }
  }
}
