import React from "react";
import SkeletonLoader from "@/components/SkeletonLoader";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <SkeletonLoader className="h-8 w-64" />
        <SkeletonLoader className="h-4 w-96" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <SkeletonLoader className="h-32 w-full" />
        <SkeletonLoader className="h-32 w-full" />
        <SkeletonLoader className="h-32 w-full" />
      </div>
      <SkeletonLoader className="h-96 w-full" />
    </div>
  );
}
