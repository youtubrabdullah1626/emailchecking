import React from "react";

interface GracefulErrorCardProps {
  title?: string;
  message: string;
  detail?: string;
  onRetry?: () => void;
  lastUpdated?: string;
}

export default function GracefulErrorCard({
  title = "Unable to load data",
  message,
  detail,
  onRetry,
  lastUpdated,
}: GracefulErrorCardProps) {
  return (
    <div className="rounded-xl border border-red-200/50 bg-red-50/30 p-6 flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-red-100 text-red-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-red-900">{title}</h3>
            <p className="text-sm text-red-700 mt-1">{message}</p>
            {detail && <p className="text-xs text-red-600/80 mt-1 font-mono break-all">{detail}</p>}
          </div>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="text-xs font-medium bg-white text-zinc-700 border border-zinc-200 hover:bg-zinc-50 px-3 py-1.5 rounded-md transition-all shadow-sm"
          >
            Retry
          </button>
        )}
      </div>
      {lastUpdated && (
        <div className="pt-4 mt-2 border-t border-red-200/50 flex justify-between items-center text-xs text-red-500">
          <span>Last successful update: {lastUpdated}</span>
        </div>
      )}
    </div>
  );
}
