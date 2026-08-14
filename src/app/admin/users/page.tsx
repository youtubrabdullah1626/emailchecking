"use client";

import React, { useState } from "react";
import { LegacyPageHeader as PageHeader } from "@/components/ui/legacy-adapters";
import { UserSearchFilters } from "./components/UserSearchFilters";
import { UserDataGrid } from "./components/UserDataGrid";
import { UserProfileDrawer } from "./components/UserProfileDrawer";
import { MockUser } from "./types";

import useSWR from "swr";
import { Loader2, AlertTriangle, Download } from "lucide-react";
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

export default function UserManagementPage() {
  const [selectedUser, setSelectedUser] = useState<MockUser | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [needsAttentionOnly, setNeedsAttentionOnly] = useState(false);
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [healthFilter, setHealthFilter] = useState("all");
  const { data, error, isLoading } = useSWR("/api/admin/users", fetcher, {
    refreshInterval: 30000, // Refresh every 30s for live ops visibility
    revalidateOnFocus: true,
  });

  const users: MockUser[] = data?.users || [];
  const totalUsers = data?.pagination?.total || 0;

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
    <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
      <div className="flex-1 space-y-6 p-8 pt-6 max-w-[1600px] w-full mx-auto">
        <PageHeader
          title="User Management"
          description="View, manage, and monitor all users across the platform."
          actions={
            <div className="flex items-center gap-3">
              <Button 
                variant={needsAttentionOnly ? "destructive" : "outline"}
                size="sm" 
                onClick={() => setNeedsAttentionOnly(!needsAttentionOnly)}
                className="gap-2"
              >
                <AlertTriangle className="h-4 w-4" />
                {needsAttentionOnly ? "Showing Needs Attention" : "Find Needs Attention"}
              </Button>
              <Button onClick={handleExportCSV} variant="outline" size="sm" className="gap-2">
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
            </div>
          }
        />
        
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>{error.message?.includes("Forbidden") ? "Access Denied" : "Connection Error"}</AlertTitle>
            <AlertDescription>
              {error.message?.includes("Forbidden") 
                ? "You do not have permission to view the user management dashboard. This area is restricted to Administrators."
                : "Failed to load customer profiles from the database."}
            </AlertDescription>
          </Alert>
        ) : (
          <div className="flex flex-col space-y-6 animate-in fade-in duration-500">
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
              <div className="h-64 flex items-center justify-center border border-border rounded-lg bg-card">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
      </div>

      <UserProfileDrawer 
        user={selectedUser} 
        isOpen={selectedUser !== null} 
        onClose={() => setSelectedUser(null)} 
      />
    </div>
  );
}
