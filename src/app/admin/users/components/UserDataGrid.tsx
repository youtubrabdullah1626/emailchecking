"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { MockUser } from "../types";
import { BlockUserDialog } from "./BlockUserDialog";
import { UnblockUserDialog } from "./UnblockUserDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, ArrowUpDown, Copy, CheckCircle2, ShieldBan, ShieldCheck } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";

interface UserDataGridProps {
  users: MockUser[];
  onUserSelected: (user: MockUser) => void;
  searchQuery: string;
}

function highlightMatch(text: string, query: string) {
  if (!query.trim() || !text) return <>{text}</>;
  const parts = text.split(new RegExp(`(${query})`, 'gi'));
  return (
    <>
      {parts.map((part, i) => 
        part.toLowerCase() === query.toLowerCase() 
          ? <span key={i} className="bg-blue-500/20 text-blue-500 font-bold px-0.5 rounded">{part}</span> 
          : part
      )}
    </>
  );
}

export function UserDataGrid({ users, onUserSelected, searchQuery }: UserDataGridProps) {
  const [userToBlock, setUserToBlock] = useState<MockUser | null>(null);
  const [userToUnblock, setUserToUnblock] = useState<MockUser | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortConfig, setSortConfig] = useState<{key: keyof MockUser, direction: 'asc'|'desc'} | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const router = useRouter();

  // Sorting Logic
  const sortedUsers = React.useMemo(() => {
    let sortableUsers = [...users];
    const currentSort = sortConfig;
    if (currentSort !== null) {
      sortableUsers.sort((a, b) => {
        const aVal = a[currentSort.key] ?? '';
        const bVal = b[currentSort.key] ?? '';
        if (aVal < bVal) {
          return currentSort.direction === 'asc' ? -1 : 1;
        }
        if (aVal > bVal) {
          return currentSort.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableUsers;
  }, [users, sortConfig]);

  const requestSort = (key: keyof MockUser) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Selection Logic
  const toggleSelectAll = () => {
    if (selectedIds.size === users.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(users.map(u => u.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBulkAction = async (action: 'suspend' | 'unblock') => {
    // In a real app, this would be a single bulk API call
    for (const id of Array.from(selectedIds)) {
      const user = users.find(u => u.id === id);
      if (user) {
        if (action === 'suspend') {
          await fetch(`/api/admin/users/${user.email}/block`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'temporary' })
          });
        } else {
          await fetch(`/api/admin/users/${user.email}/unblock`, { method: 'POST' });
        }
      }
    }
    setSelectedIds(new Set());
    router.refresh();
  };

  // Copy Logic
  const handleCopy = (e: React.MouseEvent, text: string, id: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleBlockAction = async (type: "temporary" | "permanent") => {
    if (!userToBlock) return;
    try {
      await fetch(`/api/admin/users/${userToBlock.email}/block`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type })
      });
      router.refresh();
      setUserToBlock(null);
    } catch (e) {
      console.error(e);
    }
  };

  const handleUnblock = async () => {
    if (!userToUnblock) return;
    try {
      await fetch(`/api/admin/users/${userToUnblock.email}/unblock`, { method: 'POST' });
      router.refresh();
      setUserToUnblock(null);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="rounded-md border border-border bg-card overflow-hidden">
      
      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="bg-primary/5 border-b border-border p-2.5 flex items-center justify-between px-4 animate-in fade-in slide-in-from-top-1">
          <span className="text-sm font-medium text-primary flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            {selectedIds.size} users selected
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => handleBulkAction('unblock')} className="text-emerald-600 border-emerald-200 bg-white hover:bg-emerald-50">
              <ShieldCheck className="h-4 w-4 mr-2" /> Bulk Unblock
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleBulkAction('suspend')} className="text-destructive border-destructive/30 bg-white hover:bg-destructive/10">
              <ShieldBan className="h-4 w-4 mr-2" /> Bulk Suspend
            </Button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto w-full">
        <Table>
          <TableHeader className="bg-muted/50 sticky top-0 z-10">
            <TableRow>
              <TableHead className="w-[40px]">
                <Checkbox 
                  checked={users.length > 0 && selectedIds.size === users.length} 
                  onCheckedChange={toggleSelectAll} 
                />
              </TableHead>
              <TableHead className="w-[250px] cursor-pointer hover:bg-muted" onClick={() => requestSort('name')}>
                <div className="flex items-center gap-1">Customer <ArrowUpDown className="h-3 w-3" /></div>
              </TableHead>
              <TableHead className="cursor-pointer hover:bg-muted" onClick={() => requestSort('role')}>
                <div className="flex items-center gap-1">Role <ArrowUpDown className="h-3 w-3" /></div>
              </TableHead>
              <TableHead className="cursor-pointer hover:bg-muted" onClick={() => requestSort('status')}>
                <div className="flex items-center gap-1">Status <ArrowUpDown className="h-3 w-3" /></div>
              </TableHead>
              <TableHead className="cursor-pointer hover:bg-muted" onClick={() => requestSort('health')}>
                <div className="flex items-center gap-1.5">
                  Health <ArrowUpDown className="h-3 w-3" />
                  <TooltipProvider>
                    <Tooltip delayDuration={200}>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>Overall deliverability and connection health of the account.</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </TableHead>
              <TableHead className="cursor-pointer hover:bg-muted" onClick={() => requestSort('emailsSent')}>
                <div className="flex items-center gap-1">Emails Sent <ArrowUpDown className="h-3 w-3" /></div>
              </TableHead>
              <TableHead className="cursor-pointer hover:bg-muted" onClick={() => requestSort('lastLogin')}>
                <div className="flex items-center gap-1">Last Login <ArrowUpDown className="h-3 w-3" /></div>
              </TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                  No customers found matching your criteria.
                </TableCell>
              </TableRow>
            ) : (
              sortedUsers.map((user) => (
                <TableRow 
                  key={user.id} 
                  className={`cursor-pointer transition-colors ${selectedIds.has(user.id) ? 'bg-primary/5' : 'hover:bg-muted/50'}`}
                  onClick={() => onUserSelected(user)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox 
                      checked={selectedIds.has(user.id)} 
                      onCheckedChange={() => toggleSelect(user.id)} 
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={user.avatarUrl} alt={user.name} />
                        <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col group relative pr-6">
                        <span className="font-medium">{highlightMatch(user.name, searchQuery)}</span>
                        <span className="text-xs text-muted-foreground">{highlightMatch(user.email, searchQuery)}</span>
                        
                        <button 
                          onClick={(e) => handleCopy(e, user.email, user.id)}
                          className="absolute right-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-muted rounded"
                          title="Copy Email"
                        >
                          {copiedId === user.id ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
                        </button>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.role === "Admin" ? "default" : "secondary"} className="font-normal text-xs">
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <StatusBadge 
                      status={user.status === "Active" ? "healthy" : user.status === "Idle" ? "idle" : user.status === "Suspended" ? "degraded" : "error"} 
                      label={user.status}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <span className={`h-2 w-2 rounded-full ${
                        user.health === "Excellent" ? "bg-emerald-500" :
                        user.health === "Good" ? "bg-blue-500" :
                        user.health === "Warning" ? "bg-amber-500" : "bg-destructive"
                      }`} />
                      <span className="text-sm">{user.health}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm font-medium">
                    {user.emailsSent.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {user.lastLogin}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => onUserSelected(user)}>View Profile</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem>Reset AI Credits</DropdownMenuItem>
                        <DropdownMenuItem>Reset Subscription</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {user.status === "Suspended" || user.status === "Banned" ? (
                          <DropdownMenuItem className="text-emerald-600 focus:text-emerald-600 focus:bg-emerald-50" onClick={(e) => {
                            e.stopPropagation();
                            setUserToUnblock(user);
                          }}>
                            Unblock User
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10" onClick={(e) => {
                            e.stopPropagation();
                            setUserToBlock(user);
                          }}>
                            Block User
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      
      <div className="p-4 border-t border-border flex items-center justify-between text-sm text-muted-foreground">
        <div>
          {users.length === 0 
            ? "Showing 0 customers" 
            : `Showing 1 to ${Math.min(10, users.length)} of ${users.length} customer${users.length !== 1 ? 's' : ''}`}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled>Previous</Button>
          <Button variant="outline" size="sm" disabled>Next</Button>
        </div>
      </div>

      <BlockUserDialog 
        isOpen={!!userToBlock} 
        onClose={() => setUserToBlock(null)} 
        onBlock={handleBlockAction} 
        userName={userToBlock?.name || ""} 
      />

      <UnblockUserDialog
        isOpen={!!userToUnblock}
        onClose={() => setUserToUnblock(null)}
        onConfirm={handleUnblock}
        userName={userToUnblock?.name || ""}
      />
    </div>
  );
}
