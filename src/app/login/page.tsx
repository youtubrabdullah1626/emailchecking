"use client";

import React, { useState } from "react";
import { signIn } from "next-auth/react";
import { Card, CardContent } from "@/components/ui";

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      await signIn("google", { callbackUrl: "/dashboard" });
    } catch {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-sm border border-border/80 rounded-xl bg-card">
        <CardContent className="p-8 flex flex-col items-center text-center space-y-6">
          {/* Logo */}
          <div className="mb-2 flex items-center justify-center">
            <img
              src="/silaer-logo.png"
              alt="Silaer Logo"
              className="h-16 w-16 object-contain"
            />
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Sign in to Silaer
            </h1>
            <p className="text-xs text-muted-foreground max-w-xs">
              Deterministic cold email infrastructure, sentiment classification, and reputation protection.
            </p>
          </div>

          {/* Sign In Button */}
          <div className="w-full pt-4 border-t border-border/80 space-y-3">
            <button
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="w-full h-11 flex items-center justify-center gap-3 rounded-lg bg-secondary hover:bg-secondary/80 border border-border/80 text-xs font-semibold text-foreground shadow-2xs active:scale-[0.98] transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <svg className="w-4 h-4 animate-spin text-muted-foreground" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
              )}
              {isLoading ? "Signing in..." : "Continue with Google Workspace"}
            </button>

            <p className="text-[11px] text-muted-foreground leading-relaxed">
              By continuing, you authenticate through OAuth 2.0 with verified Gmail API sending permissions.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
