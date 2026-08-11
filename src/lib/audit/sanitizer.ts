/**
 * Data Sanitization Layer
 * 
 * Ensures sensitive information never leaks into Audit Logs.
 * Must be executed recursively on any metadata or payload stored.
 */

const SENSITIVE_KEYS = new Set([
  "password",
  "token",
  "access_token",
  "refresh_token",
  "secret",
  "client_secret",
  "api_key",
  "authorization",
  "session",
  "cookie"
]);

export function sanitizeData(data: any): any {
  if (data === null || data === undefined) return data;

  if (typeof data === 'object' && !Array.isArray(data)) {
    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      if (SENSITIVE_KEYS.has(key.toLowerCase())) {
        sanitized[key] = "[REDACTED]";
      } else {
        sanitized[key] = sanitizeData(value);
      }
    }
    return sanitized;
  }

  if (Array.isArray(data)) {
    return data.map(item => sanitizeData(item));
  }

  return data;
}
