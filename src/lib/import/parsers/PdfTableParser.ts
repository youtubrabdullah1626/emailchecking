/**
 * PdfTableParser
 * Extracts text from PDF files using pdfjs-dist and attempts to infer tabular data.
 * For highly unstructured PDFs, this will fall back to returning basic extracted lines.
 * Users are encouraged to use the Universal Formatting Prompt for messy PDFs.
 */
export class PdfTableParser {
  public async parse(file: File): Promise<any[]> {
    try {
      console.log("[DEBUG] PDF Parser v2 Loaded - X-coordinate mapping enabled");
      // Dynamically import pdfjs-dist only on the client to prevent Next.js SSR crashes ("DOMMatrix is not defined")
      const pdfjsLib = await import("pdfjs-dist");
      
      if (typeof window !== "undefined" && "pdfjsWorker" in window) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = (window as any).pdfjsWorker;
      } else {
        // Use unpkg mirror to guarantee NPM package version match, and use .mjs for modern ES modules
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
      }

      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdfDocument = await loadingTask.promise;
      
      const records: any[] = [];
      let headers: string[] = [];
      let headerXs: number[] = [];

      // Very basic tabular heuristic: group texts by their vertical 'y' coordinate
      for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
        const page = await pdfDocument.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        // Extract valid text items
        const items = textContent.items.filter(i => "transform" in i && (i as any).str.trim());
        
        // Sort items strictly by Y (descending) to maintain transitivity
        items.sort((a: any, b: any) => {
          return b.transform[5] - a.transform[5];
        });

        const rows: any[][] = [];
        let currentRow: any[] = [];
        let currentY = -1;

        for (const item of items) {
          const y = (item as any).transform[5];
          if (currentY === -1 || Math.abs(currentY - y) < 8) {
            currentRow.push(item);
            if (currentY === -1) currentY = y;
          } else {
            rows.push(currentRow);
            currentRow = [item];
            currentY = y;
          }
        }

        for (const rowItems of rows) {
          // Sort items in row left-to-right (just to be safe)
          rowItems.sort((a, b) => a.transform[4] - b.transform[4]);
          
          const validItems = rowItems.filter(i => i.str.trim());
          if (validItems.length === 0) continue;

          if (headers.length === 0) {
            // Assume first row with multiple items AND at least one common CRM keyword is the header.
            // This prevents grabbing document titles like ["Prospect List", "Oct 2026"] as headers.
            if (validItems.length > 1) {
              const potentialHeaders = validItems.map(i => i.str.trim());
              const headerString = potentialHeaders.join(" ").toLowerCase();
              const hasKeyword = ["email", "name", "first", "last", "company", "title", "role"].some(kw => headerString.includes(kw));
              
              if (hasKeyword || validItems.length >= 3) {
                headers = potentialHeaders;
                headerXs = validItems.map(i => i.transform[4]);
              }
            }
          } else {
            const record: Record<string, string> = {};
            for (const item of validItems) {
              const x = item.transform[4];
              // Find closest header by X coordinate
              let closestHeaderIdx = 0;
              let minDiff = Infinity;
              for (let i = 0; i < headerXs.length; i++) {
                const diff = Math.abs(x - headerXs[i]);
                if (diff < minDiff) {
                  minDiff = diff;
                  closestHeaderIdx = i;
                }
              }
              const hName = headers[closestHeaderIdx];
              if (record[hName]) {
                record[hName] += " " + item.str.trim();
              } else {
                record[hName] = item.str.trim();
              }
            }
            if (Object.keys(record).length > 0) {
              records.push(record);
            }
          }
        }
      }
      
      return records;
    } catch (err) {
      console.error("PDF parse error", err);
      throw new Error(`PDF Parsing Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
