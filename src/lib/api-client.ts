/**
 * Reusable Typed API Client
 * Centralizes error handling, response unwrapping, and timeouts.
 */

export class ApiError extends Error {
  constructor(public status: number, public message: string, public detail?: string) {
    super(message);
    this.name = "ApiError";
  }
}

interface FetchOptions extends RequestInit {
  timeoutMs?: number;
}

export async function apiClient<T>(url: string, options: FetchOptions = {}): Promise<T> {
  const { timeoutMs = 30000, ...fetchOptions } = options;

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const defaultHeaders: Record<string, string> = {};
    if (typeof Intl !== 'undefined') {
      defaultHeaders['x-timezone'] = Intl.DateTimeFormat().resolvedOptions().timeZone;
    }
    
    // Pass the exact local midnight to the server so it knows when "today" started
    if (typeof window !== 'undefined') {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      defaultHeaders['x-local-start-of-day'] = startOfDay.toISOString();
    }

    const response = await fetch(url, {
      ...fetchOptions,
      headers: {
        ...defaultHeaders,
        ...fetchOptions.headers,
      },
      signal: controller.signal,
    });

    clearTimeout(id);

    const isJson = response.headers.get("content-type")?.includes("application/json");
    const data = isJson ? await response.json() : await response.text();

    if (!response.ok) {
      if (
        response.status === 401 &&
        typeof window !== 'undefined' &&
        window.location.pathname !== '/login' &&
        !window.location.pathname.startsWith('/dashboard') &&
        !window.location.pathname.startsWith('/admin') &&
        !window.location.pathname.startsWith('/prospects') &&
        !window.location.pathname.startsWith('/sequences') &&
        !window.location.pathname.startsWith('/replies') &&
        !window.location.pathname.startsWith('/settings')
      ) {
        window.location.href = '/login';
      }
      
      throw new ApiError(
        response.status,
        data?.error || "An unexpected error occurred",
        data?.detail || (typeof data === "string" ? data : undefined)
      );
    }

    return data as T;
  } catch (err) {
    clearTimeout(id);
    if (err instanceof ApiError) throw err;
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ApiError(408, "Request Timeout", "The server took too long to respond. Please try again.");
    }
    throw new ApiError(500, "Network Error", err instanceof Error ? err.message : "Failed to connect to the server.");
  }
}
