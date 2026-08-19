"use client";

import React, { ReactNode } from "react";

export function AnimatedPage({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`animate-in fade-in-50 duration-150 ease-out will-change-[opacity,transform] ${className}`}>
      {children}
    </div>
  );
}

export function AnimatedList({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      {children}
    </div>
  );
}

export function AnimatedItem({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`animate-in fade-in-50 duration-150 ${className}`}>
      {children}
    </div>
  );
}
