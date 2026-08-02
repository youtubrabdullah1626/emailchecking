/**
 * Persists mapping templates to localStorage to maintain backend freeze.
 */

export interface MappingTemplate {
  id: string;
  name: string;
  mappings: Record<string, string>; // File Column Name -> Schema Key
  createdAt: number;
}

const STORAGE_KEY = "outreachiq_import_templates";

export class TemplateEngine {
  public getTemplates(): MappingTemplate[] {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  public saveTemplate(name: string, mappings: Record<string, string>): void {
    if (typeof window === "undefined") return;
    try {
      const templates = this.getTemplates();
      templates.push({
        id: crypto.randomUUID(),
        name,
        mappings,
        createdAt: Date.now(),
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
    } catch (e) {
      console.error("Failed to save template", e);
    }
  }

  public findBestMatch(fileHeaders: string[]): MappingTemplate | null {
    const templates = this.getTemplates();
    if (templates.length === 0) return null;

    let bestMatch: MappingTemplate | null = null;
    let highestScore = 0;

    for (const tpl of templates) {
      // Calculate how many file headers exist in this template's keys
      let matchCount = 0;
      for (const header of fileHeaders) {
        if (tpl.mappings[header]) {
          matchCount++;
        }
      }
      
      const score = matchCount / fileHeaders.length;
      // Require at least 50% match to auto-apply a template
      if (score > 0.5 && score > highestScore) {
        highestScore = score;
        bestMatch = tpl;
      }
    }

    return bestMatch;
  }
}
