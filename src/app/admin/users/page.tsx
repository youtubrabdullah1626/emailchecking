"use client";

import React, { useState, Suspense } from "react";
import { UserCheck, Info, Sparkles, Download, ShieldAlert, AlertTriangle, Users } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { UserSearchFilters } from "./components/UserSearchFilters";
import { UserDataGrid } from "./components/UserDataGrid";
import { UserProfileDrawer } from "./components/UserProfileDrawer";
import { AssignRoleDialog } from "./components/AssignRoleDialog";
import { MockUser } from "./types";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Error ${res.status}`);
  }
  return res.json();
};

function UserManagementContent() {
  const { data: session } = useSession();
  const user = session?.user as any;
  const normalizedRole = user?.role?.toUpperCase() || "USER";
  const canAssignRoles = normalizedRole === "ADMIN" || normalizedRole === "OWNER" || user?.email === "youtubrabdullah1626@gmail.com";

  const [isAssignRoleOpen, setIsAssignRoleOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<MockUser | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [needsAttentionOnly, setNeedsAttentionOnly] = useState(false);
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [healthFilter, setHealthFilter] = useState("all");
  const { data, error, isLoading, mutate } = useSWR("/api/admin/users", fetcher, {
    refreshInterval: 30000, // Refresh every 30s for live ops visibility
    revalidateOnFocus: true,
  });

  const users: MockUser[] = data?.users || [];
  const totalUsers = data?.pagination?.total || users.length;

  // Apply filters client-side
  const filteredUsers = users.filter((u) => {
    // 1. Search Query
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!u.name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) {
        return false;
      }
    }
    // 2. Needs Attention Filter (Smart Feature)
    if (needsAttentionOnly) {
      const needsAttention = 
        u.health === "Warning" || 
        u.health === "Critical" || 
        u.status === "Suspended" || 
        u.status === "Banned";
      
      if (!needsAttention) {
        return false;
      }
    }
    // 3. Role Filter
    if (roleFilter !== "all" && u.role.toLowerCase() !== roleFilter) {
      return false;
    }
    // 3. Status Filter
    if (statusFilter !== "all" && u.status.toLowerCase() !== statusFilter) {
      return false;
    }
    // 4. Health Filter
    if (healthFilter !== "all" && u.health.toLowerCase() !== healthFilter) {
      return false;
    }
    return true;
  });

  const handleExportCSV = () => {
    const headers = ["Name", "Email", "Role", "Status", "Health", "Emails Sent", "Last Login"];
    const csvData = filteredUsers.map(u => 
      `"${u.name}","${u.email}","${u.role}","${u.status}","${u.health}",${u.emailsSent},"${u.lastLogin}"`
    );
    const csvString = [headers.join(","), ...csvData].join("\n");
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `users_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Signature Silaer Dynamic Header Banner */}
      <div className="bg-gradient-to-r from-primary/15 via-primary/5 to-card border border-primary/20 rounded-2xl p-5 md:p-6 shadow-xs relative overflow-hidden transition-colors duration-300">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start sm:items-center gap-4">
            <div className="h-11 w-11 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0 border border-primary/25 shadow-xs">
              <UserCheck className="h-5 w-5" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                  User Directory & Access Control
                </h1>
                <TooltipProvider>
                  <Tooltip delayDuration={200}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="flex items-center justify-center h-5 w-5 rounded-full bg-primary/15 text-primary hover:bg-primary/25 transition-colors cursor-help"
                      >
                        <Info className="h-3 w-3" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" align="center" className="max-w-xs p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl rounded-xl z-50 text-xs">
                      <p className="font-semibold text-slate-900 dark:text-white mb-1">
                        Enterprise RBAC Manager
                      </p>
                      <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                        Manage user accounts, assign system roles (USER, HELPER, ADMIN, OWNER), inspect active sessions, and oversee deliverability health.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                View, audit, and manage user accounts, RBAC permissions, and sending health across Silaer.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-start md:self-center">
            <Button 
              variant={needsAttentionOnly ? "destructive" : "outline"}
              size="sm" 
              onClick={() => setNeedsAttentionOnly(!needsAttentionOnly)}
              className="gap-1.5 rounded-xl border border-border bg-card/80 shadow-2xs text-xs font-semibold"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>{needsAttentionOnly ? "Showing Issues" : "Needs Attention"}</span>
            </Button>

            <Button onClick={handleExportCSV} variant="outline" size="sm" className="gap-1.5 rounded-xl border border-border bg-card/80 text-foreground shadow-2xs text-xs font-semibold hover:bg-primary/10">
              <Download className="h-3.5 w-3.5 text-primary" />
              <span className="hidden sm:inline">Export CSV</span>
            </Button>

            {canAssignRoles && (
              <Button onClick={() => setIsAssignRoleOpen(true)} size="sm" className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs rounded-xl text-xs font-semibold">
                <ShieldAlert className="h-4 w-4" />
                <span>Assign Role</span>
              </Button>
            )}
          </div>
        </div>
      </div>
      
      {error ? (
        <Alert variant="destructive" className="rounded-2xl">
          <AlertTitle>{error.message?.includes("Forbidden") ? "Access Denied" : "Connection Error"}</AlertTitle>
          <AlertDescription>
            {error.message?.includes("Forbidden") 
              ? "You do not have permission to view the user management dashboard. This area is restricted to Administrators."
              : "Failed to load customer profiles from the database."}
          </AlertDescription>
        </Alert>
      ) : (
        <div className="flex flex-col space-y-6 animate-in fade-in duration-300">
          <UserSearchFilters 
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            roleFilter={roleFilter}
            setRoleFilter={setRoleFilter}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            healthFilter={healthFilter}
            setHealthFilter={setHealthFilter}
          />
          
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-xs text-slate-500 font-medium">Loading user directory...</p>
            </div>
          ) : (
            <UserDataGrid 
              users={filteredUsers} 
              onUserSelected={setSelectedUser} 
              searchQuery={searchQuery}
            />
          )}
        </div>
      )}

      <UserProfileDrawer 
        user={selectedUser} 
        isOpen={selectedUser !== null} 
        onClose={() => setSelectedUser(null)} 
      />

      <AssignRoleDialog
        isOpen={isAssignRoleOpen}
        onClose={() => setIsAssignRoleOpen(false)}
        onSuccess={() => mutate()}
      />
    </div>
  );
}

export default function UserManagementPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-slate-400">Loading User Directory...</div>}>
      <UserManagementContent />
    </Suspense>
  );
}
