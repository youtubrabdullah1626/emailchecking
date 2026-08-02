import React from "react";

interface EmptyStateCardProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export default function EmptyStateCard({ title, description, icon, action }: EmptyStateCardProps) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50/50">
      {icon && (
        <div className="w-12 h-12 rounded-full bg-zinc-100 text-zinc-500 flex items-center justify-center mb-4">
          {icon}
        </div>
      )}
      <h3 className="text-sm font-medium text-zinc-900">{title}</h3>
      <p className="mt-1 text-sm text-zinc-500 max-w-sm">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-6 inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-zinc-900 text-zinc-50 hover:bg-zinc-900/90 h-10 px-4 py-2"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
