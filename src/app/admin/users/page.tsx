"use client";

import React from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Search } from "lucide-react";
import { LegacyPageHeader as PageHeader } from "@/components/ui/legacy-adapters";
import { LegacyLoadingState as LoadingState, LegacyErrorState as ErrorState } from "@/components/ui/legacy-adapters";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) throw new Error("Failed to load users");
  return res.json();
});

const getStringColor = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 65%, 45%)`;
};

interface UserAccount {
  email: string;
  connection_status: string;
  daily_limit: number;
  hourly_limit: number;
  sent_today: number;
  health_score: number;
  warmup_status: string;
  created_at: string;
}

export default function UsersPage() {
  const router = useRouter();
  const { data, error, isLoading } = useSWR("/api/admin/users", fetcher, {
    keepPreviousData: true
  });
  
  const users: UserAccount[] = data?.data || [];

  return (
    <div className="flex-1 space-y-6 p-8 pt-6 h-full flex flex-col">
      <PageHeader 
        title="Active Users" 
        description="Monitor system accounts, sending reputation, and daily limits."
      />

      <Card className="flex-1 flex flex-col overflow-hidden border-border/50 shadow-sm">
        <CardContent className="p-0 flex-1 flex flex-col h-full overflow-hidden">
          {error ? (
            <div className="flex-1 flex items-center justify-center p-8">
              <ErrorState 
                title="Failed to load users" 
                message={typeof error === 'string' ? error : "An unexpected error occurred while fetching user data."} 
                onRetry={() => window.location.reload()} 
              />
            </div>
          ) : isLoading && users.length === 0 ? (
            <div className="flex-1 flex items-center justify-center p-8">
              <LoadingState message="Fetching connected user accounts..." />
            </div>
          ) : (
            <div className="flex-1 overflow-auto bg-card relative">
              {users.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center p-12 text-center">
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                    <Search className="h-6 w-6 text-muted-foreground opacity-50" />
                  </div>
                  <h3 className="text-lg font-medium text-foreground mb-1">No users found</h3>
                  <p className="text-sm text-muted-foreground max-w-sm mb-6">
                    There are currently no authenticated user accounts connected to the system.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow>
                        <TableHead className="w-[280px]">Account</TableHead>
                        <TableHead>Connection</TableHead>
                        <TableHead>Health Score</TableHead>
                        <TableHead>Reputation</TableHead>
                        <TableHead>Sent Today</TableHead>
                        <TableHead>Registered</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((user) => (
                        <TableRow 
                          key={user.email} 
                          className="group hover:bg-muted/30 cursor-pointer transition-colors"
                          onClick={() => router.push(`/admin/users/${user.email}`)}
                        >
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8 border border-border shadow-sm group-hover:scale-105 transition-transform" style={{ backgroundColor: getStringColor(user.email) }}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={`https://unavatar.io/google/${user.email}?fallback=false`} alt={user.email} className="object-cover w-full h-full" onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }} />
                                <AvatarFallback className="text-white text-xs font-semibold bg-transparent">
                                  {user.email.substring(0, 1).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex flex-col">
                                <span className="font-medium text-foreground text-sm tracking-tight">{user.email}</span>
                                <span className="text-[11px] text-muted-foreground">OAUTH_GMAIL</span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <StatusBadge 
                              status={user.connection_status === "CONNECTED" ? "active" : "error"} 
                              label={user.connection_status} 
                              dot 
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 max-w-[120px]">
                              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                                <div 
                                  className={`h-full transition-all duration-500 ease-out ${user.health_score > 80 ? 'bg-emerald-500' : user.health_score > 50 ? 'bg-amber-500' : 'bg-destructive'}`} 
                                  style={{ width: `${user.health_score}%` }} 
                                />
                              </div>
                              <span className="text-xs font-medium min-w-[32px]">{user.health_score}%</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <StatusBadge 
                              status={user.warmup_status === "COMPLETED" ? "completed" : "pending"} 
                              label={user.warmup_status} 
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="text-sm font-medium">{user.sent_today} <span className="text-muted-foreground font-normal">/ {user.daily_limit}</span></span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {format(new Date(user.created_at), "MMM d, yyyy")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
