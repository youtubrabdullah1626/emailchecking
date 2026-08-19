"use client";

import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { WifiOff, RotateCcw } from "lucide-react";

/**
 * Global Resilience Provider
 *
 * Provides enterprise-grade client resilience:
 * 1. Automatic recovery from ChunkLoadErrors (version updates / stale tabs)
 * 2. Network state monitoring with graceful offline/online recovery
 * 3. Global unhandled promise rejection shielding
 */
export function GlobalResilienceProvider({ children }: { children: React.ReactNode }) {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    // 1. Monitor online/offline events
    const handleOnline = () => {
      setIsOffline(false);
      toast.success("Internet connection restored", {
        description: "Live synchronization resumed.",
        duration: 3000,
      });
    };

    const handleOffline = () => {
      setIsOffline(true);
      toast.error("Network disconnected", {
        description: "You are currently offline. Changes will sync when reconnected.",
        duration: 5000,
      });
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Initial check
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setIsOffline(true);
    }

    // 2. Global ChunkLoadError & Deployment Drift Auto-Healer
    const handleChunkError = (event: ErrorEvent | PromiseRejectionEvent) => {
      const errorMsg =
        "message" in event
          ? event.message
          : event.reason?.message || String(event.reason || "");

      const isChunkError =
        errorMsg.includes("Loading chunk") ||
        errorMsg.includes("ChunkLoadError") ||
        errorMsg.includes("Failed to fetch RSC payload") ||
        errorMsg.includes("CSS_CHUNK_LOAD_FAILED");

      if (isChunkError) {
        // Prevent infinite reload loops with a session lock
        const lastReloadKey = "silaer_chunk_reload_ts";
        const lastReload = sessionStorage.getItem(lastReloadKey);
        const now = Date.now();

        if (!lastReload || now - parseInt(lastReload, 10) > 15000) {
          sessionStorage.setItem(lastReloadKey, String(now));
          console.warn("[Resilience] ChunkLoadError detected. Auto-refreshing to latest build version...");
          window.location.reload();
        }
      }
    };

    window.addEventListener("error", handleChunkError);
    window.addEventListener("unhandledrejection", handleChunkError);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("error", handleChunkError);
      window.removeEventListener("unhandledrejection", handleChunkError);
    };
  }, []);

  return (
    <>
      {isOffline && (
        <div className="fixed top-0 inset-x-0 z-[9999] bg-amber-600 text-white text-xs font-semibold px-4 py-2 flex items-center justify-between shadow-md animate-in slide-in-from-top duration-200">
          <div className="flex items-center gap-2">
            <WifiOff className="h-4 w-4 shrink-0" />
            <span>Working in offline mode. Reconnecting...</span>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-1 bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded text-[11px] transition-colors"
          >
            <RotateCcw className="h-3 w-3" />
            Retry
          </button>
        </div>
      )}
      {children}
    </>
  );
}
