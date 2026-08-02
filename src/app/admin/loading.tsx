import React from "react";
import SkeletonLoader from "@/components/SkeletonLoader";

export default function AdminLoading() {
  return (
    <div className="flex-1 space-y-8 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <SkeletonLoader className="h-8 w-[200px]" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <SkeletonLoader className="h-32 w-full" />
        <SkeletonLoader className="h-32 w-full" />
        <SkeletonLoader className="h-32 w-full" />
        <SkeletonLoader className="h-32 w-full" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <SkeletonLoader className="h-[400px] col-span-4" />
        <SkeletonLoader className="h-[400px] col-span-3" />
      </div>
    </div>
  );
}
