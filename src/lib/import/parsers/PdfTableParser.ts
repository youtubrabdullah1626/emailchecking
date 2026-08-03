/**
 * PdfTableParser
 * Extracts text from PDF files using pdfjs-dist and attempts to infer tabular data.
 * For highly unstructured PDFs, this will fall back to returning basic extracted lines.
 * Users are encouraged to use the Universal Formatting Prompt for messy PDFs.
 */
export class PdfTableParser {
  public async parse(file: File): Promise<any[]> {
    try {
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
        
        // Group items by Y coordinate (rounding to handle slight misalignments)
        const rowsMap = new Map<number, any[]>();
        
        for (const item of textContent.items) {
          if ("transform" in item) {
            const y = Math.round(item.transform[5] / 5) * 5; // round to nearest 5
            if (!rowsMap.has(y)) rowsMap.set(y, []);
            rowsMap.get(y)!.push(item);
          }
        }
        
        // Sort rows top-to-bottom (highest Y to lowest Y in PDF coordinates usually)
        const sortedY = Array.from(rowsMap.keys()).sort((a, b) => b - a);
        
        for (const y of sortedY) {
          const rowItems = rowsMap.get(y)!;
          // Sort items in row left-to-right
          rowItems.sort((a, b) => a.transform[4] - b.transform[4]);
          
          const validItems = rowItems.filter(i => i.str.trim());
          if (validItems.length === 0) continue;

          if (headers.length === 0) {
            // Assume first row with multiple items is header
            if (validItems.length > 1) {
              headers = validItems.map(i => i.str.trim());
              headerXs = validItems.map(i => i.transform[4]);
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
