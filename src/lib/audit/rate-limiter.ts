/**
 * Enterprise Rate Limiting Abstraction
 * 
 * Protects APIs from abuse and DB exhaustion.
 * Designed behind an interface so the default in-memory store 
 * can be seamlessly replaced with Redis (e.g. Upstash) in a clustered deployment.
 */

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

export interface RateLimiter {
  check(identifier: string, limit: number, windowMs: number): Promise<RateLimitResult>;
}

/**
 * In-memory fallback implementation for single-instance deployments.
 */
class InMemoryRateLimiter implements RateLimiter {
  private store = new Map<string, { count: number; resetAt: number }>();

  async check(identifier: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    const now = Date.now();
    const record = this.store.get(identifier);

    if (!record || record.resetAt < now) {
      // First request or window expired
      const newReset = now + windowMs;
      this.store.set(identifier, { count: 1, resetAt: newReset });
      return { success: true, limit, remaining: limit - 1, reset: newReset };
    }

    if (record.count >= limit) {
      // Rate limited
      return { success: false, limit, remaining: 0, reset: record.resetAt };
    }

    // Increment
    record.count += 1;
    this.store.set(identifier, record);
    return { success: true, limit, remaining: limit - record.count, reset: record.resetAt };
  }
}

// Global singleton to preserve memory state across API route invocations during dev
const globalForRateLimiting = global as unknown as { rateLimiter: RateLimiter };
export const rateLimiter = globalForRateLimiting.rateLimiter || new InMemoryRateLimiter();
if (process.env.NODE_ENV !== "production") globalForRateLimiting.rateLimiter = rateLimiter;
