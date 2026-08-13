"use client";

import React, { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import useSWR, { SWRConfig } from 'swr';
import { SessionProvider } from 'next-auth/react';
import { apiClient } from '@/lib/api-client';
import { usePathname } from 'next/navigation';

function localStorageProvider() {
  if (typeof window === 'undefined') {
    return new Map();
  }
  
  try {
    const map = new Map(JSON.parse(localStorage.getItem('outreachiq-swr-cache') || '[]'));
    
    window.addEventListener('beforeunload', () => {
      const appCache = JSON.stringify(Array.from(map.entries()));
      localStorage.setItem('outreachiq-swr-cache', appCache);
    });
    
    return map;
  } catch (e) {
    return new Map();
  }
}

export function AppShell({ children, fallbackHeaderStats }: { children: React.ReactNode, fallbackHeaderStats?: any }) {
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const pathname = usePathname();

  const { data: stats } = useSWR("/api/dashboard/stats", (url: string) => apiClient<any>(url).catch(() => null), {
    refreshInterval: 15000,
    dedupingInterval: 5000,
  });

  // Close mobile drawer on route change
  useEffect(() => {
    setIsMobileDrawerOpen(false);
  }, [pathname]);

  // 100% Honest "Last Online" Tracker
  useEffect(() => {
    let lastTracked = 0;
    const TRACKING_INTERVAL = 5 * 60 * 1000; // 5 minutes

    const trackActivity = () => {
      const now = Date.now();
      if (now - lastTracked > TRACKING_INTERVAL) {
        lastTracked = now;
        fetch("/api/track-activity", { 
          method: "POST", 
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}) // Empty body, backend resolves primary account
        }).catch(() => {});
      }
    };

    // Track on initial load
    trackActivity();

    // Track on user interactions (debounced by the if statement above)
    window.addEventListener("click", trackActivity, { passive: true });
    window.addEventListener("scroll", trackActivity, { passive: true });
    window.addEventListener("mousemove", trackActivity, { passive: true });

    return () => {
      window.removeEventListener("click", trackActivity);
      window.removeEventListener("scroll", trackActivity);
      window.removeEventListener("mousemove", trackActivity);
    };
  }, []);

  // Don't render app chrome on the login page
  const isLoginPage = pathname === '/login';

  return (
    <SessionProvider>
    <SWRConfig 
      value={{ 
        provider: localStorageProvider,
        fallback: fallbackHeaderStats ? { "/api/dashboard/header-stats": fallbackHeaderStats } : {},
        keepPreviousData: true,
        dedupingInterval: 5000,
        fetcher: (url: string) => apiClient<any>(url).catch(() => null)
      }}
    >
      {isLoginPage ? (
        <>{children}</>
      ) : (
      <div className="flex h-screen w-full bg-background overflow-hidden transition-colors duration-500">
        {/* Desktop Sidebar (hidden on mobile) */}
        <div className="hidden md:block h-full">
          <Sidebar />
        </div>

        {/* Main Content */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Header onMenuClick={() => setIsMobileDrawerOpen(true)} />
          
          {/* Page Content */}
          <div className="flex-1 overflow-auto bg-background/50 p-4 md:p-8">
            <div className="mx-auto max-w-6xl w-full">
              {children}
            </div>
          </div>
        </main>

        {/* Mobile Sidebar Drawer overlay */}
        {isMobileDrawerOpen && (
          <div className="md:hidden fixed inset-0 z-50 flex">
            {/* Backdrop */}
            <div 
              className="fixed inset-0 bg-background/80 backdrop-blur-sm"
              onClick={() => setIsMobileDrawerOpen(false)}
            />
            {/* Drawer content */}
            <div className="relative flex w-full max-w-xs flex-col bg-background p-0 shadow-xl z-50">
              <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                <h2 className="text-lg font-semibold text-foreground">OutreachIQ</h2>
                <button onClick={() => setIsMobileDrawerOpen(false)} className="text-muted-foreground hover:text-foreground">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="h-full overflow-y-auto pb-20">
                <Sidebar isMobile onNavigate={() => setIsMobileDrawerOpen(false)} />
              </div>
            </div>
          </div>
        )}
      </div>
      )}
      </SWRConfig>
    </SessionProvider>
  );
}
