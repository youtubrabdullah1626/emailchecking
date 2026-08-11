import React from "react";
import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] space-y-4">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <h2 className="text-xl font-semibold text-foreground">Loading Sequence...</h2>
      <p className="text-sm text-muted-foreground">Fetching sequence details</p>
    </div>
  );
}
