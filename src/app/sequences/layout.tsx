export const dynamic = "force-dynamic";

import React from "react";
import { PageLockGuard } from "@/components/ui/PageLockGuard";

export default function SequencesLayout({ children }: { children: React.ReactNode }) {
  return (
    <PageLockGuard flagKey="PAGE_LOCK_SEQUENCES" moduleName="Sequences Module">
      {children}
    </PageLockGuard>
  );
}
