export const dynamic = "force-dynamic";

import React from "react";
import { PageLockGuard } from "@/components/ui/PageLockGuard";

export default function RepliesLayout({ children }: { children: React.ReactNode }) {
  return (
    <PageLockGuard flagKey="PAGE_LOCK_REPLIES" moduleName="Replies Inbox">
      {children}
    </PageLockGuard>
  );
}
