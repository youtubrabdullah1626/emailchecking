import React from "react";
import { Search, Filter, X } from "lucide-react";
import { LegacyButton as Button } from "@/components/ui/legacy-adapters";

export function AuditFilters({ onSearch, onClear }: { onSearch: (q: string) => void; onClear: () => void }) {
  return (
    <div className="flex flex-col gap-4 p-4 border-b border-border bg-muted/20">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        {/* Search Bar */}
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by User, Email, Action, or Resource..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary transition-shadow"
            onChange={(e) => onSearch(e.target.value)}
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto mt-4 sm:mt-0">
          <select className="border border-border rounded-md px-3 py-1.5 text-sm text-foreground bg-background focus:outline-none focus:ring-1 focus:ring-primary w-full sm:w-auto h-9">
            <option value="">All Categories</option>
            <option value="System">System</option>
            <option value="Authentication">Authentication</option>
            <option value="Billing">Billing</option>
          </select>
          <select className="border border-border rounded-md px-3 py-1.5 text-sm text-foreground bg-background focus:outline-none focus:ring-1 focus:ring-primary w-full sm:w-auto h-9">
            <option value="">All Severities</option>
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
          </select>
          <select className="border border-border rounded-md px-3 py-1.5 text-sm text-foreground bg-background focus:outline-none focus:ring-1 focus:ring-primary w-full sm:w-auto h-9">
            <option value="">All Statuses</option>
            <option value="Success">Success</option>
            <option value="Pending">Pending</option>
            <option value="Failed">Failed</option>
          </select>
          <select className="border border-border rounded-md px-3 py-1.5 text-sm text-foreground bg-background focus:outline-none focus:ring-1 focus:ring-primary w-full sm:w-auto h-9">
            <option value="">All Time</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
          </select>

          <Button variant="outline" size="sm" onClick={onClear} className="gap-2 w-full sm:w-auto justify-center h-9 border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground font-normal">
            <X className="h-4 w-4" />
            Clear Filters
          </Button>
        </div>
      </div>
    </div>
  );
}
