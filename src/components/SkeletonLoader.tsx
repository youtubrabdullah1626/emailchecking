import React from "react";

interface SkeletonLoaderProps {
  className?: string;
}

export default function SkeletonLoader({ className = "" }: SkeletonLoaderProps) {
  return (
    <div className={`animate-pulse rounded-md bg-zinc-200/60 ${className}`} />
  );
}
