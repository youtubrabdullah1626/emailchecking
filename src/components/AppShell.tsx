"use client";

import React, { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { SWRConfig } from 'swr';
import { apiClient } from '@/lib/api-client';

import { usePathname } from 'next/navigation';

export function AppShell({ children }: { children: React.ReactNode }) {
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const pathname = usePathname();

  // Close mobile drawer on route change
  useEffect(() => {
    setIsMobileDrawerOpen(false);
  }, [pathname]);

  return (
    <SWRConfig 
      value={{ 
        revalidateOnFocus: false,
        keepPreviousData: true,
        dedupingInterval: 5000,
        fetcher: (url: string) => apiClient<any>(url).catch(() => null)
      }}
    >
      <div className="flex h-screen w-full bg-background overflow-hidden">
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
    </SWRConfig>
  );
}
