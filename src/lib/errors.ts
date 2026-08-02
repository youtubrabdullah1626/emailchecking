/**
 * Application Error Taxonomy — Phase 8
 *
 * Provides consistent, typed error codes across all API routes and domain logic.
 * Errors returned to callers NEVER include:
 *   - Database connection strings
 *   - OAuth tokens or refresh tokens
 *   - Internal stack traces
 *   - API keys
 *
 * Use AppError or createApiError() in API routes to produce safe, typed responses.
 */

export type AppErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "CONFLICT"
  | "FORBIDDEN"
  | "AUTHENTICATION_ERROR"
  | "RATE_LIMITED"
  | "EXTERNAL_SERVICE_ERROR"
  | "DATABASE_ERROR"
  | "TIMEOUT"
  | "CONFIGURATION_ERROR"
  | "INVALID_STATE_TRANSITION"
  | "UNKNOWN_ERROR";

export interface AppError {
  code: AppErrorCode;
  message: string;
  /** Optional safe detail for logging — never expose in API response directly */
  detail?: string;
}

/**
 * Map AppErrorCode to HTTP status code.
 */
export function httpStatusForCode(code: AppErrorCode): number {
  switch (code) {
    case "VALIDATION_ERROR":
      return 422;
    case "NOT_FOUND":
      return 404;
    case "CONFLICT":
      return 409;
    case "FORBIDDEN":
      return 403;
    case "AUTHENTICATION_ERROR":
      return 401;
    case "RATE_LIMITED":
      return 429;
    case "EXTERNAL_SERVICE_ERROR":
      return 502;
    case "DATABASE_ERROR":
      return 503;
    case "TIMEOUT":
      return 504;
    case "CONFIGURATION_ERROR":
      return 500;
    case "INVALID_STATE_TRANSITION":
      return 422;
    case "UNKNOWN_ERROR":
    default:
      return 500;
  }
}

/**
 * Extract a safe error message from any caught value.
 * Scrubs known sensitive patterns.
 */
export function safeErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message
      .replace(/ya29\.[A-Za-z0-9._-]+/g, "[ACCESS_TOKEN_REDACTED]")
      .replace(/refresh_token=[^&\s]*/gi, "refresh_token=[REDACTED]")
      .replace(/postgresql:\/\/[^\s]*/gi, "[DATABASE_URL_REDACTED]")
      .replace(/DATABASE_URL=[^\s]*/gi, "DATABASE_URL=[REDACTED]")
      .slice(0, 500);
  }
  return "Unknown error";
}
