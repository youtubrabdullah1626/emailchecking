import React from "react";
import { Filter, X } from "lucide-react";
import { LegacyButton as Button } from "@/components/ui/legacy-adapters";

export interface AuditFilterState {
  category: string;
  severity: string;
  status: string;
  time: string;
}

export function AuditFilters({ 
  filters, 
  setFilters, 
  onClear 
}: { 
  filters: AuditFilterState;
  setFilters: (filters: AuditFilterState) => void;
  onClear: () => void;
}) {
  const handleChange = (key: keyof AuditFilterState) => (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilters({ ...filters, [key]: e.target.value });
  };

  const getSelectClass = (value: string) => {
    const base = "border rounded-md px-3 py-1.5 text-[13px] bg-background focus:outline-none focus:ring-1 h-[34px] appearance-none pr-8 relative transition-colors";
    if (value) {
      return `${base} border-blue-500 text-blue-600 focus:border-blue-500 focus:ring-blue-500`;
    }
    return `${base} border-border text-slate-700 focus:ring-slate-300`;
  };

  // Base64 chevron SVG
  const chevronSvg = 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%2364748b%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")';
  const blueChevronSvg = 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%232563eb%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")';

  return (
    <div className="p-3.5 border border-border rounded-lg bg-card shadow-sm w-full">
      <div className="flex flex-wrap items-center gap-3">
        <select 
          value={filters.category}
          onChange={handleChange("category")}
          className={getSelectClass(filters.category)} 
          style={{ backgroundImage: filters.category ? blueChevronSvg : chevronSvg, backgroundRepeat: 'no-repeat', backgroundPosition: 'right .7rem top 50%', backgroundSize: '.65rem auto' }}
        >
          <option value="">All Categories</option>
          <option value="SYSTEM">System</option>
          <option value="AUTHENTICATION">Authentication</option>
          <option value="BILLING">Billing</option>
          <option value="USER_MANAGEMENT">User Management</option>
          <option value="PROSPECT">Prospect</option>
          <option value="SEQUENCE">Sequence</option>
        </select>
        <select 
          value={filters.severity}
          onChange={handleChange("severity")}
          className={getSelectClass(filters.severity)} 
          style={{ backgroundImage: filters.severity ? blueChevronSvg : chevronSvg, backgroundRepeat: 'no-repeat', backgroundPosition: 'right .7rem top 50%', backgroundSize: '.65rem auto' }}
        >
          <option value="">All Severities</option>
          <option value="INFO">Low (Info)</option>
          <option value="WARNING">Medium (Warning)</option>
          <option value="CRITICAL">High (Critical)</option>
        </select>
        <select 
          value={filters.status}
          onChange={handleChange("status")}
          className={getSelectClass(filters.status)} 
          style={{ backgroundImage: filters.status ? blueChevronSvg : chevronSvg, backgroundRepeat: 'no-repeat', backgroundPosition: 'right .7rem top 50%', backgroundSize: '.65rem auto' }}
        >
          <option value="">All Statuses</option>
          <option value="SUCCESS">Success</option>
          <option value="FAILURE">Failure</option>
        </select>
        <select 
          value={filters.time}
          onChange={handleChange("time")}
          className={getSelectClass(filters.time)} 
          style={{ backgroundImage: filters.time ? blueChevronSvg : chevronSvg, backgroundRepeat: 'no-repeat', backgroundPosition: 'right .7rem top 50%', backgroundSize: '.65rem auto' }}
        >
          <option value="">All Time</option>
          <option value="24h">Last 24 Hours</option>
          <option value="7d">Last 7 Days</option>
        </select>

        <button 
          onClick={onClear} 
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-[13px] text-slate-600 bg-background hover:bg-muted transition-colors h-[34px]"
        >
          <X className="h-3.5 w-3.5" />
          Clear Filters
        </button>
      </div>
    </div>
  );
}
