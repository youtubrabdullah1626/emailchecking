export const dynamic = "force-dynamic";

import React from "react";
import { PageLockGuard } from "@/components/ui/PageLockGuard";

export default function SmartImportLayout({ children }: { children: React.ReactNode }) {
  return (
    <PageLockGuard flagKey="PAGE_LOCK_SMART_IMPORT" moduleName="Smart Lead Import">
      {children}
    </PageLockGuard>
  );
}
