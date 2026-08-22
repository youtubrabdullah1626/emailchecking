"use client";

import { useState, useCallback } from "react";
import useSWR from "swr";
import { TimelineEmailItem } from "@/app/api/timeline/route";

interface TimelineResponse {
  items: TimelineEmailItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  stats: {
    totalSent: number;
    totalOpened: number;
    openRate: number;
    totalReplied: number;
    replyRate: number;
    totalFailed: number;
    avgLatencyMs: number;
    bannerTheme?: string;
  };
}

const fetcher = async (url: string): Promise<TimelineResponse> => {
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Failed to fetch timeline data");
  }
  return res.json();
};

export function useTimelineData() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [timeRange, setTimeRange] = useState("all");
  const [page, setPage] = useState(1);
  const [isLiveSync, setIsLiveSync] = useState(true);

  // Build query string
  const queryParams = new URLSearchParams({
    search,
    status: statusFilter,
    timeRange,
    page: page.toString(),
    limit: "50",
  });

  const [cachedTimeline, setCachedTimeline] = useState<any>(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("silaer_cached_timeline_data");
        if (raw) return JSON.parse(raw);
      } catch {}
    }
    return null;
  });

  const { data, error, isLoading, isValidating, mutate } = useSWR<TimelineResponse>(
    `/api/timeline?${queryParams.toString()}`,
    fetcher,
    {
      refreshInterval: isLiveSync ? 3000 : 0,
      revalidateOnFocus: true,
      dedupingInterval: 1000,
      keepPreviousData: true,
      fallbackData: cachedTimeline,
      onSuccess: (resData) => {
        if (resData && typeof window !== "undefined") {
          try {
            localStorage.setItem("silaer_cached_timeline_data", JSON.stringify(resData));
          } catch {}
        }
      },
    }
  );

  const toggleLiveSync = useCallback(() => {
    setIsLiveSync((prev) => !prev);
  }, []);

  const refreshNow = useCallback(() => {
    return mutate();
  }, [mutate]);

  return {
    items: data?.items || [],
    pagination: data?.pagination || { total: 0, page: 1, limit: 50, totalPages: 1 },
    stats: data?.stats || {
      totalSent: 0,
      totalOpened: 0,
      openRate: 0,
      totalReplied: 0,
      replyRate: 0,
      totalFailed: 0,
      avgLatencyMs: 0,
    },
    isLoading,
    isValidating,
    error,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    timeRange,
    setTimeRange,
    page,
    setPage,
    isLiveSync,
    toggleLiveSync,
    refreshNow,
  };
}
