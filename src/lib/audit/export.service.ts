import { AuditLog } from "@prisma/client";

/**
 * Enterprise Export Service
 * 
 * Modular architecture supporting multiple export formats (CSV, JSON, PDF).
 * Exports respect current filters and search queries.
 */
export class ExportService {
  /**
   * Generates a CSV string from an array of Audit Logs.
   */
  public generateCSV(logs: AuditLog[]): string {
    if (!logs.length) return "";

    // Define standard headers
    const headers = [
      "Event ID",
      "Timestamp",
      "Action",
      "Category",
      "Status",
      "Actor Name",
      "Actor Email",
      "Target Resource",
      "Resource ID",
      "IP Address",
      "Correlation ID"
    ];

    const rows = logs.map(log => [
      log.id,
      log.created_at.toISOString(),
      log.action,
      log.category,
      log.status,
      log.actor_name || "",
      log.actor_email || "",
      log.target_resource || "",
      log.resource_id || "",
      log.ip_address || "",
      log.correlation_id || ""
    ].map(val => this.escapeCSV(val)));

    return [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
  }

  /**
   * Generates a formatted JSON string for export.
   */
  public generateJSON(logs: AuditLog[]): string {
    // Strip purely internal DB fields if needed before export
    return JSON.stringify(logs, null, 2);
  }

  /**
   * Properly escapes CSV values containing commas, quotes, or newlines.
   */
  private escapeCSV(value: string | null | undefined): string {
    if (!value) return "";
    const str = String(value);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }
}
