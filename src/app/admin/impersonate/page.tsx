"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, ShieldCheck, UserCircle2 } from "lucide-react";

function ImpersonationContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const email = searchParams.get("email");
  const [status, setStatus] = useState("Verifying admin credentials...");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!email) {
      router.push("/admin/users");
      return;
    }

    const sequence = async () => {
      setProgress(25);
      await new Promise(r => setTimeout(r, 800));
      
      setStatus(`Generating secure override token for ${email}...`);
      setProgress(60);
      await new Promise(r => setTimeout(r, 1000));
      
      setStatus("Establishing user session...");
      setProgress(90);
      await new Promise(r => setTimeout(r, 600));
      
      setProgress(100);
      setStatus("Authentication successful. Redirecting...");
      await new Promise(r => setTimeout(r, 400));
      
      router.push("/dashboard");
    };

    sequence();
  }, [email, router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] max-w-md mx-auto text-center space-y-6 animate-in fade-in zoom-in duration-500">
      <div className="relative">
        <div className="absolute inset-0 bg-emerald-500/20 blur-xl rounded-full" />
        <div className="h-24 w-24 bg-white border border-emerald-100 rounded-full flex items-center justify-center shadow-sm relative z-10">
          {progress === 100 ? (
            <ShieldCheck className="h-10 w-10 text-emerald-500 animate-in zoom-in" />
          ) : (
            <Loader2 className="h-10 w-10 text-emerald-500 animate-spin" />
          )}
        </div>
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {progress === 100 ? "Session Established" : "Admin Impersonation"}
        </h1>
        <p className="text-muted-foreground">
          {status}
        </p>
      </div>

      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
        <div 
          className="h-full bg-emerald-500 transition-all duration-500 ease-out" 
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="pt-4 flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-4 py-2 rounded-md border border-border">
        <UserCircle2 className="h-4 w-4" />
        <span>Target: <strong>{email}</strong></span>
      </div>
    </div>
  );
}

export default function ImpersonationPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <div className="flex-1 flex items-center justify-center p-8">
        <Suspense fallback={<div className="animate-pulse flex flex-col items-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground"/></div>}>
          <ImpersonationContent />
        </Suspense>
      </div>
    </div>
  );
}
