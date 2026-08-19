import React from "react";
import Link from "next/link";
import { Lock, Home, Rocket, Sparkles, ArrowRight } from "lucide-react";
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

  // If locked and user is NOT admin: render sleek, exciting "Coming Soon" screen
  return (
    <div className="min-h-[75vh] flex flex-col items-center justify-center p-6 text-center max-w-xl mx-auto animate-in fade-in zoom-in-95 duration-300">
      <div className="bg-card border border-border/80 rounded-3xl p-8 md:p-12 shadow-sm space-y-6 w-full relative overflow-hidden">
        {/* Subtle decorative background glow */}
        <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-64 h-32 bg-primary/15 rounded-full blur-2xl pointer-events-none" />

        <div className="relative space-y-4">
          {/* Visual Icon Badge */}
          <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 text-primary flex items-center justify-center border border-primary/25 shadow-xs">
            <Rocket className="w-8 h-8 -rotate-12 animate-pulse" />
          </div>

          {/* Status Pill */}
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            Launching Soon
          </div>

          {/* Heading */}
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-foreground">
            We will launch this page shortly with a boom! 💥
          </h1>

          {/* Description */}
          <p className="text-sm md:text-base text-muted-foreground leading-relaxed max-w-md mx-auto">
            {customMessage ||
              `We are crafting powerful new capabilities and optimizations for ${access.moduleName || moduleName || "this section"}. Stay tuned!`}
          </p>
        </div>

        {/* Action Button */}
        <div className="pt-2 flex items-center justify-center">
          <Button asChild className="gap-2 font-semibold px-8 py-2.5 h-11 rounded-xl shadow-xs">
            <Link href="/dashboard">
              <Home className="w-4 h-4" />
              Return to Dashboard
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
