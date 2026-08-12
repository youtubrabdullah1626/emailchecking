/**
 * Cache Abstraction Layer
 *
 * The application NEVER knows whether it's talking to in-memory or Redis.
 * Future migration is a single implementation swap, zero application changes.
 */

export interface ICacheAdapter {
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T, ttlMs?: number): void;
  delete(key: string): void;
  clear(): void;
  keys(): string[];
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number | null;
}

/**
 * In-Process Memory Cache
 * Used in single-instance deployments (current).
 * Swap for RedisCacheAdapter when horizontally scaling.
 */
export class MemoryCacheAdapter implements ICacheAdapter {
  private store = new Map<string, CacheEntry<any>>();

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    // Check TTL expiry
    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }

    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs?: number): void {
    this.store.set(key, {
      value,
      expiresAt: ttlMs ? Date.now() + ttlMs : null,
    });
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  keys(): string[] {
    return Array.from(this.store.keys());
  }
}

/**
 * Singleton Cache Instance
 * Replace with RedisCacheAdapter when horizontally scaling.
 */
export const configCache = new MemoryCacheAdapter();

// Cache key namespacing constants
export const CACHE_KEYS = {
  ALL_FLAGS: "platform:flags:all",
  FLAG: (key: string) => `platform:flag:${key}`,
  ALL_CONFIGS: "platform:configs:all",
  CONFIG: (key: string) => `platform:config:${key}`,
  ALL_PROVIDERS: "platform:providers:all",
  PROVIDER: (key: string) => `platform:provider:${key}`,
} as const;

// Default cache TTL: 30 seconds (matches architecture spec)
export const DEFAULT_CACHE_TTL_MS = 30_000;
