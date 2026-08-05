import Papa from "papaparse";

export class CsvParser {
  public async parse(file: File): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const allData: any[] = [];
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        chunk: (results) => {
          // Enterprise Security: Sanitize raw data instantly to prevent macro injection
          for (const row of results.data as any[]) {
            const sanitizedRow: any = {};
            for (const key in row) {
              if (row[key] === null || row[key] === undefined) {
                sanitizedRow[key] = row[key];
                continue;
              }
              let val = String(row[key]).trim();
              sanitizedRow[key] = val;
            }
            allData.push(sanitizedRow);
          }
        },
        complete: () => {
          resolve(allData);
        },
        error: (error) => reject(error),
      });
    });
  }
}
