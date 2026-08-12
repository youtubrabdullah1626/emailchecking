export type AuditStatus = "Success" | "Failed" | "Warning" | "Pending";

export type ActionCategory = 
  | "Login"
  | "Logout"
  | "Create"
  | "Update"
  | "Delete"
  | "Restore"
  | "Import"
  | "Export"
  | "Subscription"
  | "Billing"
  | "Gmail"
  | "AI"
  | "Scheduler"
  | "Campaign"
  | "Security"
  | "Settings"
  | "System";

export interface AuditLogEvent {
  id: string;
  time: string; // ISO String
  actorName: string;
  actorEmail: string;
  action: string; // e.g. "Deleted Sequence"
  category: ActionCategory;
  resourceName: string; // e.g. "Roofing Campaign"
  resourceType: string;
  resourceId: string;
  status: AuditStatus;
  ipAddress: string;
  device: string;
  browser: string;
  os: string;
  country: string;
  sessionId: string;
  requestId: string;
  apiSource: string;
  environment: string;
  severity?: "CRITICAL" | "WARNING" | "INFO";
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  metadata?: Record<string, any>;
  errorMsg?: string;
}
