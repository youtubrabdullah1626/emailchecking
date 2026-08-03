import { UNIVERSAL_SCHEMA } from "../schema/UniversalSchema";

export class MappingEngine {
  // Dictionary of known common variations for intelligent auto-mapping
  private dictionary: Record<string, string[]> = {
    email: ["email", "email address", "work email", "business email", "e-mail", "contact email"],
    firstName: ["first name", "firstname", "fname", "first"],
    lastName: ["last name", "lastname", "lname", "last"],
    companyName: ["company", "company name", "organization", "org", "account", "business"],
    title: ["title", "job title", "role", "position"],
    linkedinProfile: ["linkedin", "linkedin url", "linkedin profile", "li url"],
    website: ["website", "site", "url", "company domain", "domain"],
    phone: ["phone", "phone number", "mobile", "cell", "work phone"],
    country: ["country", "nation"],
    city: ["city", "location"],
    initialMessage: ["initial message", "email content", "message", "body", "content", "email body", "message body"],
    followUp1: ["follow up 1", "followup 1", "fu1", "reply 1", "email 2", "second email"],
    followUp2: ["follow up 2", "followup 2", "fu2", "reply 2", "email 3", "third email"],
    followUp3: ["follow up 3", "followup 3", "fu3", "reply 3", "email 4", "fourth email"],
  };

  private normalize(str: string): string {
    return str.toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  public generateAutoMapping(fileHeaders: string[]): Record<string, string> {
    const mapping: Record<string, string> = {};

    for (const header of fileHeaders) {
      const norm = this.normalize(header);
      let matched = false;

      // Check dictionary
      for (const [schemaKey, variations] of Object.entries(this.dictionary)) {
        if (variations.some(v => this.normalize(v) === norm)) {
          mapping[header] = schemaKey;
          matched = true;
          break;
        }
      }

      // If no dictionary match, see if it exactly matches a schema key
      if (!matched) {
        const exactMatch = UNIVERSAL_SCHEMA.find(s => this.normalize(s.key) === norm || this.normalize(s.label) === norm);
        if (exactMatch) {
          mapping[header] = exactMatch.key;
        } else {
          // Leave unmapped, will default to "custom"
          mapping[header] = "";
        }
      }
    }

    return mapping;
  }
}
