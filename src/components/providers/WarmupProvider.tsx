"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { IWarmupService, WarmupSettings, WarmupStatus, getWarmupService } from "@/lib/warmup/WarmupService";
import { toast } from "sonner";

interface WarmupContextType {
  settings: WarmupSettings | null;
  status: WarmupStatus | null;
  todaySchedule: string[] | null;
  isLoading: boolean;
  isSaving: boolean;
  updateSettings: (updates: Partial<WarmupSettings>) => Promise<void>;
  refresh: () => Promise<void>;
}

const WarmupContext = createContext<WarmupContextType | undefined>(undefined);

export function WarmupProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<WarmupSettings | null>(null);
  const [status, setStatus] = useState<WarmupStatus | null>(null);
  const [todaySchedule, setTodaySchedule] = useState<string[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [service] = useState<IWarmupService>(() => getWarmupService());

  const fetchWarmupData = async () => {
    setIsLoading(true);
    try {
      const [fetchedSettings, fetchedStatus] = await Promise.all([
        service.getSettings(),
        service.getStatus(),
      ]);
      setSettings(fetchedSettings);
      setStatus(fetchedStatus);
      
      const schedule = await service.getTodaySchedule(new Date());
      setTodaySchedule(schedule);
    } catch (error) {
      console.error("Failed to fetch warmup data", error);
      toast.error("Failed to load warmup configuration.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWarmupData();
    
    // Auto-refresh when user switches back to this tab
    const handleFocus = () => fetchWarmupData();
    // Auto-refresh when localStorage is changed in another tab
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "warmup_settings") {
        fetchWarmupData();
      }
    };
    
    window.addEventListener("focus", handleFocus);
    window.addEventListener("storage", handleStorage);
    
    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("storage", handleStorage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service]);

  const updateSettings = async (updates: Partial<WarmupSettings>) => {
    setIsSaving(true);
    try {
      const newSettings = await service.updateSettings(updates);
      setSettings(newSettings);
      
      // Re-fetch status and schedule because settings change affects them
      const [fetchedStatus, schedule] = await Promise.all([
        service.getStatus(),
        service.getTodaySchedule(new Date())
      ]);
      setStatus(fetchedStatus);
      setTodaySchedule(schedule);
      
      toast.success("Warmup configuration saved.");
    } catch (error) {
      console.error("Failed to save warmup data", error);
      toast.error("Failed to save warmup configuration.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <WarmupContext.Provider
      value={{
        settings,
        status,
        todaySchedule,
        isLoading,
        isSaving,
        updateSettings,
        refresh: fetchWarmupData,
      }}
    >
      {children}
    </WarmupContext.Provider>
  );
}

export function useWarmup() {
  const context = useContext(WarmupContext);
  if (context === undefined) {
    throw new Error("useWarmup must be used within a WarmupProvider");
  }
  return context;
}
