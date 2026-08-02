import { ImportRecord } from "../ImportService";

/**
 * Maps raw parsed file rows (JSON objects) into strongly typed ImportRecord objects.
 * Updated to use explicitly mapped keys from the Manual/Auto Mapping phase.
 */
export class ImportMapper {
  
  public mapRowWithConfig(rawRow: Record<string, any>, index: number, config: Record<string, string>): ImportRecord {
    const record: any = {
      id: crypto.randomUUID(),
      email: "",
      customFields: {},
      isValid: true,
      errors: [],
      warnings: [],
      isDuplicate: false,
    };

    // Iterate through raw keys and place them into the record based on the config
    for (const [fileHeader, value] of Object.entries(rawRow)) {
      if (value === null || value === undefined) continue;
      let strVal = String(value).trim();
      if (!strVal) continue;
      
      // Enterprise Security: CSV Formula/Macro Injection Protection
      if (/^[=+\-@]/.test(strVal)) {
        strVal = "'" + strVal;
      }

      const mappedKey = config[fileHeader];

      if (!mappedKey) {
        // If unmapped, store in customFields by its original header name
        record.customFields[fileHeader] = strVal;
      } else if (
        [
          "email", "firstName", "lastName", "companyName", "title", 
          "linkedinProfile", "website", "phone", "country", "city"
        ].includes(mappedKey)
      ) {
        record[mappedKey] = strVal;
      } else {
        // Known custom fields (e.g. followUp1) or anything else mapped explicitly
        record.customFields[mappedKey] = strVal;
      }
    }

    return record as ImportRecord;
  }
}
