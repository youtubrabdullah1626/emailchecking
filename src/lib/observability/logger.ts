import { AsyncLocalStorage } from "async_hooks";

export type LogSeverity = "DEBUG" | "INFO" | "WARN" | "ERROR" | "CRITICAL";

export interface LogEntry {
  timestamp: string;
  requestId: string | undefined;
  environment: string;
  module?: string;
  operation?: string;
  duration?: number;
  severity: LogSeverity;
  message: string;
  metadata?: Record<string, any>;
  error?: string;
  stack?: string;
}

// Global AsyncLocalStorage for Correlation IDs
export const requestContext = new AsyncLocalStorage<{ requestId: string }>();

// Redaction patterns
const REDACT_KEYS = ["access_token", "refresh_token", "client_secret", "cookie", "authorization", "admin_secret", "cron_secret", "scheduler_secret", "database_url", "direct_url"];
const REDACT_VALUES = [
  /ya29\.[A-Za-z0-9._-]+/g,
  /1\/\/[0-9a-zA-Z_-]+/g, // Typical Google refresh token format
  /postgresql:\/\/[^:]+:[^@]+@[^/]+\/[^?\s]+/g, // Redact Postgres connection strings
];

function redactString(val: string): string {
  let redacted = val;
  for (const regex of REDACT_VALUES) {
    redacted = redacted.replace(regex, "[REDACTED]");
  }
  return redacted;
}

function redactMetadata(obj: any): any {
  if (typeof obj !== "object" || obj === null) return obj;
  if (Array.isArray(obj)) return obj.map(redactMetadata);
  
  const redactedObj: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (REDACT_KEYS.some((k) => key.toLowerCase().includes(k))) {
      redactedObj[key] = "[REDACTED]";
    } else if (typeof value === "string") {
      redactedObj[key] = redactString(value);
    } else if (typeof value === "object") {
      redactedObj[key] = redactMetadata(value);
    } else {
      redactedObj[key] = value;
    }
  }
  return redactedObj;
}

class Logger {
  private baseContext: Partial<LogEntry> = {};

  constructor(moduleName?: string) {
    this.baseContext.module = moduleName;
    this.baseContext.environment = process.env.NODE_ENV || "unknown";
  }

  public child(moduleName: string): Logger {
    return new Logger(moduleName);
  }

  private write(severity: LogSeverity, message: string, meta?: Record<string, any>) {
    const context = requestContext.getStore();
    
    // Performance timing extraction
    let duration: number | undefined;
    const cleanMeta = { ...meta };
    if (cleanMeta.duration !== undefined) {
      duration = cleanMeta.duration;
      delete cleanMeta.duration;
    }
    
    let errorStr: string | undefined;
    let stackStr: string | undefined;
    if (cleanMeta.error instanceof Error) {
      errorStr = cleanMeta.error.message;
      stackStr = cleanMeta.error.stack;
      delete cleanMeta.error;
    } else if (cleanMeta.error) {
      errorStr = String(cleanMeta.error);
      delete cleanMeta.error;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      requestId: context?.requestId,
      environment: this.baseContext.environment!,
      module: this.baseContext.module || cleanMeta.module,
      operation: cleanMeta.operation,
      severity,
      message: redactString(message),
      metadata: Object.keys(cleanMeta).length > 0 ? redactMetadata(cleanMeta) : undefined,
      duration,
      error: errorStr ? redactString(errorStr) : undefined,
      stack: stackStr ? redactString(stackStr) : undefined,
    };

    // Output JSON string strictly
    const jsonOutput = JSON.stringify(entry);
    
    if (severity === "ERROR" || severity === "CRITICAL") {
      console.error(jsonOutput);
    } else if (severity === "WARN") {
      console.warn(jsonOutput);
    } else if (severity === "DEBUG") {
      // Don't clutter unless debugging
      if (process.env.DEBUG === "true" || process.env.NODE_ENV === "development") {
         console.debug(jsonOutput);
      }
    } else {
      console.log(jsonOutput);
    }
  }

  public info(message: string, meta: Record<string, any> = {}) {
    this.write("INFO", message, meta);
  }

  public warn(message: string, meta: Record<string, any> = {}) {
    this.write("WARN", message, meta);
  }

  public error(message: string, meta: Record<string, any> = {}) {
    this.write("ERROR", message, meta);
  }

  public debug(message: string, meta: Record<string, any> = {}) {
    this.write("DEBUG", message, meta);
  }
  
  public critical(message: string, meta: Record<string, any> = {}) {
    this.write("CRITICAL", message, meta);
  }
  
  /**
   * Run a function with performance tracking, logging upon completion.
   */
  public async track<T>(
    operation: string, 
    fn: () => Promise<T>, 
    meta?: Record<string, any>
  ): Promise<T> {
    const start = performance.now();
    try {
      const result = await fn();
      const end = performance.now();
      this.info(`${operation} completed`, { operation, duration: Math.round(end - start), ...meta });
      return result;
    } catch (error) {
      const end = performance.now();
      this.error(`${operation} failed`, { operation, duration: Math.round(end - start), error, ...meta });
      throw error;
    }
  }
}

export const logger = new Logger();
