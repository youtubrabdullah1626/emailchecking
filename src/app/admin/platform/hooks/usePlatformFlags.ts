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
  const qs = searchParams ? searchParams.toString() : "";
  const key = `${FLAGS_KEY}?environment=${environment}${qs ? `&${qs}` : ""}`;

  const { data, error, isLoading, mutate: revalidate } = useSWR<PaginatedResponse<ApiFeatureFlag>>(
    key,
    fetcher,
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 5000,
      errorRetryCount: 3,
      errorRetryInterval: 2000,
    }
  );

  const flags = data?.data.items ?? [];
  const nextCursor = data?.data.nextCursor ?? null;
  const total = data?.data.total ?? 0;

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
  ): Promise<boolean> {
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
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      await revalidate(); // Confirm with real data
      return true;
    } catch (err: any) {
      await revalidate(); // Roll back optimistic update
      setMutationError(err.message ?? "Failed to update flag");
      return false;
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
