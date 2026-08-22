"use client";

/**
 * usePlatformProviders — SWR hook for provider routing configuration
 */

import useSWR from "swr";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { ApiProviderConfig, ApiProviderHistory, ApiResponse, PaginatedResponse } from "./types";

const PROVIDERS_KEY = "/api/admin/platform/providers";
const fetcher = (url: string) =>
  fetch(url).then((res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  });

export function usePlatformProviders(environment = "production") {
  const searchParams = useSearchParams();
  const search = searchParams?.get("search") || "";
  const category = searchParams?.get("category") || "";

  const queryParts = [`environment=${environment}`];
  if (search) queryParts.push(`search=${encodeURIComponent(search)}`);
  if (category) queryParts.push(`category=${encodeURIComponent(category)}`);

  const key = `${PROVIDERS_KEY}?${queryParts.join("&")}`;

  const { data, error, isLoading, mutate: revalidate } = useSWR<PaginatedResponse<ApiProviderConfig>>(
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

  const providers = data?.data.items ?? [];
  const nextCursor = data?.data.nextCursor ?? null;
  const total = data?.data.total ?? 0;

  const [isMutating, setIsMutating] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);

  async function updateProvider(
    providerKey: string,
    activeProvider: string,
    reason?: string
  ): Promise<boolean> {
    setIsMutating(true);
    setMutationError(null);

    // Optimistic update
    const optimistic = {
      data: {
        items: providers.map((p) =>
          p.key === providerKey ? { ...p, active_provider: activeProvider } : p
        ),
        nextCursor,
        total,
      },
    } as PaginatedResponse<ApiProviderConfig>;
    await revalidate(optimistic, { revalidate: false });

    try {
      const res = await fetch(PROVIDERS_KEY, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: providerKey, activeProvider, reason, environment }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      try {
        await revalidate();
      } catch {}
      return true;
    } catch (err: any) {
      setMutationError(err.message ?? "Failed to update provider");
      return false;
    } finally {
      setIsMutating(false);
    }
  }

  async function rollbackProvider(historyId: string): Promise<boolean> {
    setIsMutating(true);
    setMutationError(null);
    try {
      const res = await fetch("/api/admin/platform/rollback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: "provider", historyId }),
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
    providers,
    nextCursor,
    total,
    isLoading,
    error: error?.message ?? null,
    isMutating,
    mutationError,
    clearMutationError: () => setMutationError(null),
    updateProvider,
    rollbackProvider,
    revalidate,
  };
}

export function useProviderHistory(providerKey: string | null) {
  const key = providerKey ? `/api/admin/platform/providers/history?key=${providerKey}` : null;
  const { data, error, isLoading } = useSWR<ApiResponse<ApiProviderHistory[]>>(key, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 10000,
  });
  return {
    history: data?.data ?? [],
    isLoading,
    error: error?.message ?? null,
  };
}
