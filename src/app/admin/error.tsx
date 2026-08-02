"use client";

import { useEffect } from "react";
import GracefulErrorCard from "@/components/GracefulErrorCard";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Admin route error:", error);
  }, [error]);

  return (
    <div className="flex h-full w-full items-center justify-center p-8">
      <div className="max-w-md w-full">
        <GracefulErrorCard
          title="System Operations Error"
          message="We encountered an unexpected issue loading the operations data."
          detail={error.message}
          onRetry={reset}
        />
      </div>
    </div>
  );
}
