export const dynamic = "force-dynamic";

import React from "react";
import { PageLockGuard } from "@/components/ui/PageLockGuard";

export default function TimelineInspectorLayout({ children }: { children: React.ReactNode }) {
  return (
    <PageLockGuard flagKey="PAGE_LOCK_TIMELINE" moduleName="Timeline Inspector">
      {children}
    </PageLockGuard>
  );
}
