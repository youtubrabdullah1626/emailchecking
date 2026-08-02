export class JsonParser {
  public async parse(file: File): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed)) {
            resolve(parsed);
          } else if (parsed && typeof parsed === "object") {
            // If it's a single object or wrapper, try to find an array
            const arrays = Object.values(parsed).filter(Array.isArray);
            if (arrays.length > 0) resolve(arrays[0]);
            else resolve([parsed]);
          } else {
            reject(new Error("JSON does not contain an array of records"));
          }
        } catch (err) {
          reject(new Error("Invalid JSON file"));
        }
      };
      reader.onerror = () => reject(new Error("Failed to read JSON file"));
      reader.readAsText(file);
    });
  }
}
