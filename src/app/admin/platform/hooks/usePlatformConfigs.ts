"use client";

/**
 * usePlatformConfigs — SWR hook for platform configuration values
 */

import useSWR from "swr";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { ApiPlatformConfig, ApiConfigHistory, ApiResponse, PaginatedResponse } from "./types";

const CONFIGS_KEY = "/api/admin/platform/configs";
const fetcher = (url: string) =>
  fetch(url).then((res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  });

export function usePlatformConfigs(environment = "production") {
  const searchParams = useSearchParams();
  const search = searchParams?.get("search") || "";
  const category = searchParams?.get("category") || "";
  const risk_level = searchParams?.get("risk_level") || "";

  const queryParts = [`environment=${environment}`];
  if (search) queryParts.push(`search=${encodeURIComponent(search)}`);
  if (category) queryParts.push(`category=${encodeURIComponent(category)}`);
  if (risk_level) queryParts.push(`risk_level=${encodeURIComponent(risk_level)}`);

  const key = `${CONFIGS_KEY}?${queryParts.join("&")}`;

  const { data, error, isLoading, mutate: revalidate } = useSWR<PaginatedResponse<ApiPlatformConfig>>(
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

  const configs: ApiPlatformConfig[] = ((data as any)?.data?.items ?? (data as any)?.items ?? []) as ApiPlatformConfig[];
  const nextCursor = (data as any)?.data?.nextCursor ?? (data as any)?.nextCursor ?? null;
  const total = (data as any)?.data?.total ?? (data as any)?.total ?? configs.length;

  const [isMutating, setIsMutating] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);

  async function updateConfig(
    configKey: string,
    value: unknown,
    reason?: string
  ): Promise<{ ok: boolean; error?: string; data?: any }> {
    setIsMutating(true);
    setMutationError(null);

    // Optimistic update
    const optimistic = {
      data: {
        items: configs.map((c) => (c.key === configKey ? { ...c, value } : c)),
        nextCursor,
        total,
      },
    } as PaginatedResponse<ApiPlatformConfig>;
    await revalidate(optimistic, { revalidate: false });

    try {
      const res = await fetch(CONFIGS_KEY, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: configKey, value, reason, environment }),
      });
      const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      if (!res.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      try {
        await revalidate();
      } catch {}
      return { ok: true, data: data.data };
    } catch (err: any) {
      const errorMessage = err.message ?? "Failed to update configuration";
      setMutationError(errorMessage);
      return { ok: false, error: errorMessage };
    } finally {
      setIsMutating(false);
    }
  }

  async function rollbackConfig(historyId: string): Promise<boolean> {
    setIsMutating(true);
    setMutationError(null);
    try {
      const res = await fetch("/api/admin/platform/rollback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: "config", historyId }),
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

  async function validateValue(configKey: string, value: unknown): Promise<{ valid: boolean; errors: string[] }> {
    try {
      const res = await fetch("/api/admin/platform/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: "config", key: configKey, value }),
      });
      if (!res.ok) return { valid: false, errors: ["Validation request failed"] };
      return res.json();
    } catch {
      return { valid: false, errors: ["Network error during validation"] };
    }
  }

  return {
    configs,
    nextCursor,
    total,
    isLoading,
    error: error?.message ?? null,
    isMutating,
    mutationError,
    clearMutationError: () => setMutationError(null),
    updateConfig,
    rollbackConfig,
    validateValue,
    revalidate,
  };
}

export function useConfigHistory(configKey: string | null) {
  const key = configKey ? `/api/admin/platform/configs/history?key=${configKey}` : null;
  const { data, error, isLoading } = useSWR<ApiResponse<ApiConfigHistory[]>>(key, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 10000,
  });
  return {
    history: data?.data ?? [],
    isLoading,
    error: error?.message ?? null,
  };
}
