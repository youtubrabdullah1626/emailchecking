import useSWRInfinite from "swr/infinite";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((res) => {
  if (!res.ok) throw new Error("An error occurred while fetching the data.");
  return res.json();
});

export interface AuditLogFilters {
  q?: string;
  category?: string;
  status?: string;
  severity?: string;
  time?: string;
}

export function useAuditLogs(filters: AuditLogFilters, limit = 50, isLiveMode = false) {
  const getKey = (pageIndex: number, previousPageData: any) => {
    // Reached the end
    if (previousPageData && !previousPageData.pagination?.nextCursor) return null;

    const params = new URLSearchParams();
    params.set("limit", limit.toString());
    
    if (filters.q) params.set("q", filters.q);
    if (filters.category) params.set("category", filters.category);
    if (filters.status) params.set("status", filters.status);
    if (filters.severity) params.set("severity", filters.severity);
    if (filters.time) params.set("time", filters.time);

    // Add cursor for next pages
    if (pageIndex > 0 && previousPageData?.pagination?.nextCursor) {
      params.set("cursor", previousPageData.pagination.nextCursor);
    }

    return `/api/admin/audit?${params.toString()}`;
  };

  const { data, error, size, setSize, isValidating, mutate } = useSWRInfinite(getKey, fetcher, {
    revalidateOnFocus: isLiveMode, // Prevent aggressive re-fetching unless in live mode
    persistSize: true,
    keepPreviousData: true, // Crucial for instant SaaS feel (prevents skeleton flash when changing filters)
    refreshInterval: isLiveMode ? 3000 : 0 // Poll every 3 seconds if live mode is on
  });

  const logs = data ? data.flatMap(page => (page.data || []).map((raw: any) => {
    const isSystem = raw.actor_type === 'SYSTEM' || raw.actor_id === 'system' || !raw.actor_email;
    const isScheduler = raw.category === 'SCHEDULER' || (raw.action && raw.action.toLowerCase().includes('scheduler'));
    const resolvedActorName = isSystem 
      ? (isScheduler ? 'System Scheduler' : 'System Engine')
      : (raw.actor_name || raw.actor_email?.split('@')[0] || raw.actor_email || 'System');

    const resolvedResource = raw.metadata?.resourceName 
      || raw.target_resource 
      || (isScheduler ? 'Dispatch Scheduler' : (raw.category ? `${raw.category} Service` : 'System Service'));

    return {
      id: raw.id,
      time: raw.created_at,
      actorName: resolvedActorName,
      actorEmail: raw.actor_email || (isSystem ? 'system@internal' : ''),
      action: raw.action || 'System Event',
      category: raw.category || 'System',
      resourceName: resolvedResource,
      resourceType: raw.target_resource || (isScheduler ? 'Scheduler Engine' : 'System'),
      resourceId: raw.resource_id || '',
      status: raw.status === 'SUCCESS' ? 'Success' : raw.status === 'FAILURE' ? 'Failed' : 'Warning',
      ipAddress: raw.ip_address || '',
      device: raw.user_agent || 'Internal System Event',
      country: raw.metadata?.country || '',
      browser: raw.metadata?.browser || '',
      os: raw.metadata?.os || '',
      severity: raw.severity || raw.metadata?.riskLevel || 'INFO',
      oldValues: raw.old_values || null,
      newValues: raw.new_values || null,
      // the rest are passed directly for the drawer details if needed
      ...raw
    };
  })) : [];
  const isLoadingInitialData = !data && !error;
  const isLoadingMore =
    isLoadingInitialData ||
    (size > 0 && data && typeof data[size - 1] === "undefined");
  const isEmpty = data?.[0]?.data.length === 0;
  const isReachingEnd =
    isEmpty || (data && data[data.length - 1]?.pagination?.nextCursor === undefined);
  const stats = data?.[0]?.stats || { total: 0, successCount: 0, warningCount: 0, criticalCount: 0 };

  return {
    logs,
    stats,
    error,
    isLoading: isLoadingInitialData,
    isLoadingMore,
    isRefreshing: isValidating,
    isReachingEnd,
    isEmpty,
    loadMore: () => setSize(size + 1),
    refresh: () => mutate()
  };
}

export function useAuditEvent(id: string | null) {
  const { data, error, isValidating } = useSWR(
    id ? `/api/admin/audit/${id}` : null,
    fetcher
  );

  return {
    eventData: data,
    isLoading: isValidating && !data,
    error
  };
}
