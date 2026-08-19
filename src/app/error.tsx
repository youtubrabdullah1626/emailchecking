"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { AlertCircle, RotateCcw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log client error for telemetry
    console.error("[APP_ROUTE_ERROR]", error);

    // If chunk mismatch after deployment, auto-reload once
    if (
      error.message?.includes("Loading chunk") ||
      error.message?.includes("ChunkLoadError")
    ) {
      const lastKey = "silaer_err_reload";
      const last = sessionStorage.getItem(lastKey);
      if (!last || Date.now() - parseInt(last, 10) > 10000) {
        sessionStorage.setItem(lastKey, String(Date.now()));
        window.location.reload();
      }
    }
  }, [error]);

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md w-full bg-card border border-border/80 rounded-2xl p-8 shadow-sm space-y-6">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
          <AlertCircle className="w-7 h-7" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Something unexpected occurred
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            We encountered a temporary interface or network hiccup. Your data and background campaigns remain safe.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Button
            onClick={() => reset()}
            className="w-full sm:w-auto gap-2 font-semibold shadow-xs"
          >
            <RotateCcw className="w-4 h-4" />
            Try Again
          </Button>

          <Button
            variant="outline"
            asChild
            className="w-full sm:w-auto gap-2 font-semibold"
          >
            <Link href="/dashboard">
              <Home className="w-4 h-4" />
              Go to Dashboard
            </Link>
          </Button>
        </div>

        {process.env.NODE_ENV === "development" && (
          <div className="mt-4 p-3 bg-muted rounded-lg text-left text-xs font-mono text-muted-foreground overflow-auto max-h-32">
            {error.message}
          </div>
        )}
      </div>
    </div>
  );
}
