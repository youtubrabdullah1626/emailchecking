import { AuditLogEvent } from "./types";

export const MOCK_AUDIT_LOGS: AuditLogEvent[] = [
  {
    id: "evt_1a2b3c4d",
    time: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    actorName: "Abdullah",
    actorEmail: "abdullah@example.com",
    action: "Deleted Sequence",
    category: "Campaign",
    resourceName: "Roofing Campaign",
    resourceType: "Sequence",
    resourceId: "seq_98765",
    status: "Success",
    ipAddress: "192.168.1.42",
    device: "MacBook Pro",
    browser: "Chrome 114.0",
    os: "macOS 13.4",
    country: "United States",
    sessionId: "sess_x8f9a2",
    requestId: "req_001",
    apiSource: "Web App",
    environment: "Production",
    oldValues: {
      status: "ACTIVE"
    },
    newValues: {
      status: "DELETED"
    },
    metadata: {
      reason: "User manually deleted from dashboard"
    }
  },
  {
    id: "evt_5e6f7g8h",
    time: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    actorName: "Ali",
    actorEmail: "ali@example.com",
    action: "Connected Gmail",
    category: "Gmail",
    resourceName: "ali@example.com",
    resourceType: "Google Account",
    resourceId: "gmail_auth_443",
    status: "Success",
    ipAddress: "10.0.0.12",
    device: "Windows Desktop",
    browser: "Edge 112",
    os: "Windows 11",
    country: "Canada",
    sessionId: "sess_y3z8b1",
    requestId: "req_002",
    apiSource: "Web App",
    environment: "Production",
    metadata: {
      scopes: ["https://mail.google.com/", "https://www.googleapis.com/auth/userinfo.email"]
    }
  },
  {
    id: "evt_9i0j1k2l",
    time: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    actorName: "John",
    actorEmail: "john@example.com",
    action: "Imported Prospects",
    category: "Import",
    resourceName: "320 Records",
    resourceType: "Import Job",
    resourceId: "imp_29381",
    status: "Success",
    ipAddress: "172.16.254.1",
    device: "iPad Pro",
    browser: "Safari 16.0",
    os: "iOS 16",
    country: "United Kingdom",
    sessionId: "sess_a1b2c3",
    requestId: "req_003",
    apiSource: "Web App",
    environment: "Production",
    metadata: {
      successCount: 318,
      failedCount: 2,
      fileName: "leads_q3.csv"
    }
  },
  {
    id: "evt_3m4n5o6p",
    time: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    actorName: "Sarah",
    actorEmail: "sarah@example.com",
    action: "Purchased Pro Plan",
    category: "Billing",
    resourceName: "Subscription",
    resourceType: "Billing Profile",
    resourceId: "sub_112233",
    status: "Success",
    ipAddress: "8.8.8.8",
    device: "iPhone 13",
    browser: "Safari Mobile",
    os: "iOS 15.5",
    country: "Australia",
    sessionId: "sess_q9w8e7",
    requestId: "req_004",
    apiSource: "Web App",
    environment: "Production",
    oldValues: {
      plan: "Free"
    },
    newValues: {
      plan: "Pro",
      billingCycle: "Annual"
    }
  },
  {
    id: "evt_7q8r9s0t",
    time: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
    actorName: "System",
    actorEmail: "system@outreach.local",
    action: "Renewed Gmail Watch",
    category: "System",
    resourceName: "info@example.com",
    resourceType: "GmailWatchState",
    resourceId: "info@example.com",
    status: "Failed",
    ipAddress: "127.0.0.1",
    device: "Internal Server",
    browser: "Node.js",
    os: "Linux",
    country: "USA",
    sessionId: "system",
    requestId: "sys_cron_005",
    apiSource: "Cron Worker",
    environment: "Production",
    errorMsg: "Google API returned 401 Unauthorized - Token Expired"
  },
  {
    id: "evt_1u2v3w4x",
    time: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
    actorName: "Admin User",
    actorEmail: "admin@example.com",
    action: "Updated Feature Flag",
    category: "Settings",
    resourceName: "AI Replier Enabled",
    resourceType: "Feature Flag",
    resourceId: "flag_ai_replier",
    status: "Success",
    ipAddress: "4.4.4.4",
    device: "MacBook Air",
    browser: "Firefox 110",
    os: "macOS 12.0",
    country: "Germany",
    sessionId: "sess_m9n8b7",
    requestId: "req_006",
    apiSource: "Web App",
    environment: "Production",
    oldValues: {
      status: "DISABLED"
    },
    newValues: {
      status: "ENABLED"
    }
  }
];
