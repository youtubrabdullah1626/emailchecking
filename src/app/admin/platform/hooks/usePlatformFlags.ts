"use client";

/**
 * usePlatformFlags — SWR hook for feature flags
 *
 * Responsibilities:
 * - Fetch all flags from GET /api/admin/platform/flags
 * - Provide optimistic toggle mutation
 * - Provide rollback mutation
 * - Automatic revalidation, deduplication, retry
 */

import useSWR, { mutate } from "swr";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { ApiFeatureFlag, ApiFlagHistory, ApiResponse, PaginatedResponse } from "./types";

const FLAGS_KEY = "/api/admin/platform/flags";
const fetcher = (url: string) =>
  fetch(url).then((res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  });

export function usePlatformFlags(environment = "production") {
  const searchParams = useSearchParams();
  const search = searchParams?.get("search") || "";
  const category = searchParams?.get("category") || "";
  const risk_level = searchParams?.get("risk_level") || "";

  const queryParts = [`environment=${environment}`];
  if (search) queryParts.push(`search=${encodeURIComponent(search)}`);
  if (category) queryParts.push(`category=${encodeURIComponent(category)}`);
  if (risk_level) queryParts.push(`risk_level=${encodeURIComponent(risk_level)}`);

  const key = `${FLAGS_KEY}?${queryParts.join("&")}`;

  const { data, error, isLoading, mutate: revalidate } = useSWR<PaginatedResponse<ApiFeatureFlag>>(
    key,
    fetcher,
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 5000,
      keepPreviousData: true,
      errorRetryCount: 3,
      errorRetryInterval: 2000,
    }
  );

  const flags: ApiFeatureFlag[] = ((data as any)?.data?.items ?? (data as any)?.items ?? []) as ApiFeatureFlag[];
  const nextCursor = (data as any)?.data?.nextCursor ?? (data as any)?.nextCursor ?? null;
  const total = (data as any)?.data?.total ?? (data as any)?.total ?? flags.length;

  const [isMutating, setIsMutating] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);

  /**
   * Toggle a flag on/off with optimistic update.
   * Rolls back if the API call fails.
   */
  async function toggleFlag(
    flagKey: string,
    enabled: boolean,
    reason?: string
  ): Promise<{ ok: boolean; error?: string; data?: any }> {
    setIsMutating(true);
    setMutationError(null);

    // Optimistic update
    const optimistic = {
      data: {
        items: flags.map((f) => (f.key === flagKey ? { ...f, enabled } : f)),
        nextCursor,
        total,
      },
    } as PaginatedResponse<ApiFeatureFlag>;
    await revalidate(optimistic, { revalidate: false });

    try {
      const res = await fetch(FLAGS_KEY, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: flagKey, enabled, reason, environment }),
      });
      const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      if (!res.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      try {
        await revalidate(); // Confirm with real data
      } catch {}
      return { ok: true, data: data.data };
    } catch (err: any) {
      await revalidate(); // Roll back optimistic update
      const errorMessage = err.message ?? "Failed to update feature flag";
      setMutationError(errorMessage);
      return { ok: false, error: errorMessage };
    } finally {
      setIsMutating(false);
    }
  }

  async function rollbackFlag(historyId: string): Promise<boolean> {
    setIsMutating(true);
    setMutationError(null);
    try {
      const res = await fetch("/api/admin/platform/rollback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: "flag", historyId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      await revalidate();
      return true;
    } catch (err: any) {
      setMutationError(err.message ?? "Rollback failed");
      return false;
    } finally {
      setIsMutating(false);
    }
  }

  return {
    flags,
    nextCursor,
    total,
    isLoading,
    error: error?.message ?? null,
    isMutating,
    mutationError,
    clearMutationError: () => setMutationError(null),
    toggleFlag,
    rollbackFlag,
    revalidate,
  };
}

// ── Per-flag history hook ─────────────────────────────────────────────────────

export function useFlagHistory(flagKey: string | null) {
  const key = flagKey ? `/api/admin/platform/flags/history?key=${flagKey}` : null;
  const { data, error, isLoading } = useSWR<ApiResponse<ApiFlagHistory[]>>(key, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 10000,
  });
  return {
    history: data?.data ?? [],
    isLoading,
    error: error?.message ?? null,
  };
}
