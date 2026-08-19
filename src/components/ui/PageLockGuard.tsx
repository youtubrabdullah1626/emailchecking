import React from "react";
import Link from "next/link";
import { Lock, Home, ShieldAlert, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { evaluatePageAccess } from "@/lib/platform/page-lock";

interface PageLockGuardProps {
  flagKey: string;
  moduleName?: string;
  customMessage?: string;
  children: React.ReactNode;
}

export async function PageLockGuard({
  flagKey,
  moduleName,
  customMessage,
  children,
}: PageLockGuardProps) {
  const access = await evaluatePageAccess(flagKey);

  // If unlocked, render children directly
  if (!access.isLocked) {
    return <>{children}</>;
  }

  // If locked, but user is Admin or Supreme Owner: allow access with Admin Preview Banner
  if (access.isAdmin) {
    return (
      <div className="space-y-4">
        <div className="bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-300 px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>
              <strong>Admin Preview Mode:</strong> The {access.moduleName || moduleName || "module"} is currently locked for regular users.
            </span>
          </div>
          <Link
            href="/admin/platform?tab=feature-flags"
            className="hover:underline flex items-center gap-1 font-bold text-amber-700 dark:text-amber-200"
          >
            Manage in Platform Config &rarr;
          </Link>
        </div>
        {children}
      </div>
    );
  }

  // If locked and user is NOT admin: render sleek Maintenance Screen
  return (
    <div className="min-h-[75vh] flex flex-col items-center justify-center p-6 text-center max-w-2xl mx-auto animate-in fade-in zoom-in-95 duration-300">
      <div className="bg-card border border-border/80 rounded-3xl p-8 md:p-12 shadow-sm space-y-6 w-full relative overflow-hidden">
        {/* Subtle decorative background gradient */}
        <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-primary/10 via-primary/5 to-transparent pointer-events-none" />

        <div className="relative">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shadow-xs mb-2">
            <Lock className="w-8 h-8" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs font-semibold mb-3">
            <ShieldAlert className="w-3.5 h-3.5" />
            Temporary Maintenance
          </div>

          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
            {access.moduleName || moduleName || "This Module"} is Temporarily Locked
          </h1>

          <p className="text-sm md:text-base text-muted-foreground mt-3 leading-relaxed max-w-lg mx-auto">
            {customMessage ||
              `We are currently optimizing the ${access.moduleName || moduleName || "feature"} with performance upgrades and new capabilities. Access will resume shortly.`}
          </p>
        </div>

        <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button asChild className="gap-2 font-semibold px-6 shadow-xs w-full sm:w-auto">
            <Link href="/dashboard">
              <Home className="w-4 h-4" />
              Return to Dashboard
            </Link>
          </Button>
          <Button variant="outline" asChild className="gap-2 font-semibold px-6 w-full sm:w-auto">
            <Link href="/dashboard">
              View Dashboard
              <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
