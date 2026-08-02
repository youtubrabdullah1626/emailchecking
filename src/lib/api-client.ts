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
  const { timeoutMs = 15000, ...fetchOptions } = options;

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });

    clearTimeout(id);

    const isJson = response.headers.get("content-type")?.includes("application/json");
    const data = isJson ? await response.json() : await response.text();

    if (!response.ok) {
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
