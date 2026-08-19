export const dynamic = "force-dynamic";

import React from "react";
import { PageLockGuard } from "@/components/ui/PageLockGuard";

export default function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  return (
    <PageLockGuard flagKey="PAGE_LOCK_ANALYTICS" moduleName="Analytics & Reports">
      {children}
    </PageLockGuard>
  );
}
