"use client";

import React, { useState, useMemo } from "react";
import { FastLink } from "@/components/ui/fast-link";
import { motion, AnimatePresence } from "framer-motion";
import { format, formatDistanceToNow } from "date-fns";
import { LegacyPageHeader as PageHeader } from "@/components/ui/legacy-adapters";
import {
  LegacyLoadingState as LoadingState,
  LegacyErrorState as ErrorState,
} from "@/components/ui/legacy-adapters";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Search,
  Plus,
  Filter,
  Check,
  MoreHorizontal,
  Trash,
  ExternalLink,
  Info,
  History,
  Sparkles,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import useSWR, { mutate } from "swr";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Error ${res.status}`);
  }
  return res.json();
};

interface ProspectDetail {
  id: string;
  name: string;
  email: string;
  company: string;
  status: string;
  created_at: string;
  lastActivityAt: string | null;
  source?: string;
  campaign?: {
    id: string;
    name: string;
  } | null;
  sequence: {
    status: string;
    steps: {
      id: string;
      step_number: number;
      status: string;
    }[];
  } | null;
}

function highlightMatch(text: string, query: string) {
  if (!query.trim() || !text) return <>{text}</>;
  const parts = text.split(new RegExp(`(${query})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <span
            key={i}
            className="bg-blue-500/20 text-blue-500 font-bold px-0.5 rounded"
          >
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}

import { useSearchParams, useRouter } from "next/navigation";

function ProspectsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const campaignIdFilter = searchParams.get("campaign_id");
  const sourceFilter = searchParams.get("source");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [prospectToDelete, setProspectToDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const { data: campaignsData } = useSWR("/api/campaigns", fetcher);
  const campaigns = campaignsData?.data || [];

  const { data, error, isLoading, mutate: mutateProspects } = useSWR("/api/prospects", fetcher, {
    keepPreviousData: true,
  });

  const handleDeleteProspect = (id: string, name: string) => {
    setProspectToDelete({ id, name });
  };

  const confirmDeleteProspect = () => {
    if (!prospectToDelete) return;
    const { id, name } = prospectToDelete;
    
    // 1. Close dialog immediately (0ms)
    setProspectToDelete(null);

    // 2. Instantly mark as deleted in local state for 0ms reactive animation
    setDeletedIds((prev) => new Set(prev).add(id));

    // 3. Instantly update SWR cache without page reload
    mutateProspects(
      (current: any) => {
        if (!current?.data) return current;
        return {
          ...current,
          data: current.data.filter((p: any) => p.id !== id),
        };
      },
      false
    );

    // 4. Show instant toast with 1-click Undo
    let isUndone = false;
    toast.success(`Prospect "${name}" deleted`, {
      action: {
        label: "Undo",
        onClick: () => {
          isUndone = true;
          // Instantly bring row back with smooth spring entry
          setDeletedIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
          mutateProspects();
          toast.info("Prospect restored");
        },
      },
      duration: 5000,
    });

    // 5. Execute in background asynchronously after undo window
    setTimeout(async () => {
      if (isUndone) return;
      try {
        const res = await fetch(`/api/prospects/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Failed to delete prospect on server");
        mutateProspects();
        mutate("/api/dashboard/stats");
        mutate("/api/replies");
      } catch (err: any) {
        setDeletedIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        mutateProspects();
        toast.error(err.message || "Failed to delete prospect");
      }
    }, 4500);
  };

  const prospects: ProspectDetail[] = useMemo(
    () => data?.data || [],
    [data?.data],
  );

  const filteredProspects = useMemo(() => {
    return prospects.filter((p) => {
      // 0. Filter out optimistically deleted
      if (deletedIds.has(p.id)) return false;

      // 0.1 Campaign Filter
      if (campaignIdFilter && p.campaign?.id !== campaignIdFilter) {
        return false;
      }

      // 0.5. Source Filter
      const isSmartImport = p.source === "SMART_IMPORT" || !!p.campaign;
      
      if (sourceFilter === "smart_import") {
        // When toggle is ON: Show ONLY Smart Imports
        if (!isSmartImport) return false;
      } else {
        // When toggle is OFF: Show ONLY Manual (Hide Smart Imports)
        if (isSmartImport) return false;
      }

      // 1. Status Filter
      if (statusFilter !== "ALL" && p.status !== statusFilter) {
        return false;
      }

      // 2. Search Filter
      const q = search.toLowerCase().trim();
      return (
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        (p.company || "").toLowerCase().includes(q)
      );
    });
  }, [prospects, search, statusFilter, campaignIdFilter, sourceFilter]);

  const total = filteredProspects.length;

  return (
    <div className="flex-1 space-y-6 p-8 pt-6 h-full flex flex-col">
      <div className="space-y-4">

        <PageHeader
          title={
            <div className="flex items-center gap-2.5">
              Prospects
              <TooltipProvider>
                <Tooltip delayDuration={200}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="flex items-center justify-center h-6 w-6 rounded-full bg-muted/50 text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors focus:outline-none cursor-help mt-1"
                    >
                      <Info className="h-3.5 w-3.5" strokeWidth={2.5} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent
                    side="right"
                    align="center"
                    className="max-w-[280px] p-4 bg-white border border-slate-200 shadow-xl rounded-xl z-50"
                  >
                    <p className="font-semibold text-slate-900 mb-2">
                      What is a Prospect?
                    </p>
                    <div className="text-slate-600 text-xs leading-relaxed space-y-2">
                      <p>A prospect is anyone you want to contact.</p>
                      <p>
                        Add them here, and the Smart Engine will automatically
                        handle all emails and follow-ups. ⚡
                      </p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          }
          description="Manage your contacts and their sequence status."
          actions={
            <>
              <div className="flex items-center space-x-2 border rounded-md px-3 py-1.5 bg-card">
                <Switch
                  id="smart-import-mode"
                  checked={sourceFilter === "smart_import" || !!campaignIdFilter}
                  onCheckedChange={(checked) => {
                    router.push(
                      checked
                        ? "/prospects?source=smart_import"
                        : "/prospects"
                    );
                  }}
                />
                <Label htmlFor="smart-import-mode" className="text-sm cursor-pointer select-none">
                  Smart Imports Only
                </Label>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <Filter className="h-4 w-4" />
                    {statusFilter === "ALL"
                      ? "Status"
                      : statusFilter.charAt(0) +
                        statusFilter.slice(1).toLowerCase()}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuCheckboxItem
                    checked={statusFilter === "ALL"}
                    onCheckedChange={() => setStatusFilter("ALL")}
                  >
                    All Statuses
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={statusFilter === "ACTIVE"}
                    onCheckedChange={() => setStatusFilter("ACTIVE")}
                  >
                    Active
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={statusFilter === "REPLIED"}
                    onCheckedChange={() => setStatusFilter("REPLIED")}
                  >
                    Replied
                  </DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button className="gap-2" asChild>
                <Link prefetch={true} href="/prospects/new">
                  <Plus className="h-4 w-4" />
                  Add Prospect
                </Link>
              </Button>
            </>
          }
        />
      </div>

      <div className="flex items-center justify-between">
        <div className="relative w-[300px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search name, email, or company..."
            className="pl-9 bg-card"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="text-sm text-muted-foreground">
          {total} prospect{total !== 1 ? "s" : ""}
        </div>
      </div>

      <Card className="flex-1 flex flex-col overflow-hidden border-border/50">
        <CardContent className="p-0 flex-1 flex flex-col h-full overflow-hidden">
          {error ? (
            <div className="flex-1 flex items-center justify-center p-8">
              <ErrorState
                title="Failed to load prospects"
                message={
                  typeof error === "string" ? error : "An error occurred"
                }
                onRetry={() => window.location.reload()}
              />
            </div>
          ) : isLoading && prospects.length === 0 ? (
            <div className="flex-1 flex items-center justify-center p-8">
              <LoadingState message="Loading prospects..." />
            </div>
          ) : (
            <div className="flex-1 overflow-auto bg-card relative">
              {filteredProspects.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center p-12 text-center">
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                    <Search className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-medium text-foreground mb-1">
                    No prospects found
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-sm mb-6">
                    {search
                      ? "No prospects match your search criteria. Try a different term."
                      : "You haven't added any prospects yet."}
                  </p>
                  {!search && (
                    <Button asChild>
                      <Link prefetch={true} href="/prospects/new">
                        Add Your First Prospect
                      </Link>
                    </Button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="w-[300px]">Prospect</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Sequence</TableHead>
                        <TableHead>Last Activity</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <AnimatePresence initial={false}>
                        {filteredProspects.map((prospect) => {
                          let sequenceBadgeStatus = "none";
                          let sequenceLabel = "None";

                          if (prospect.sequence) {
                            if (prospect.sequence.status === "ACTIVE") {
                              sequenceBadgeStatus = "active";
                              sequenceLabel = "Active";
                            } else if (prospect.sequence.status === "STOPPED") {
                              sequenceBadgeStatus = "error";
                              sequenceLabel = "Stopped";
                            } else if (prospect.sequence.status === "COMPLETED") {
                              sequenceBadgeStatus = "completed";
                              sequenceLabel = "Completed";
                            } else {
                              sequenceBadgeStatus = "scheduled";
                              sequenceLabel = "Scheduled";
                            }
                          }

                          const lastActivity =
                            prospect.lastActivityAt || prospect.created_at;

                          let prospectBadgeStatus = "none";
                          let displayStatus = "Active";

                          if (prospect.status === "REPLIED") {
                            prospectBadgeStatus = "completed";
                            displayStatus = "Replied";
                          } else if (prospect.status === "STOPPED") {
                            prospectBadgeStatus = "stopped";
                            displayStatus = "Stopped";
                          } else if (prospect.status === "COMPLETED") {
                            prospectBadgeStatus = "completed";
                            displayStatus = "Completed";
                          } else {
                            // ACTIVE
                            if (!prospect.sequence) {
                              prospectBadgeStatus = "pending";
                              displayStatus = "Not Started";
                            } else {
                              prospectBadgeStatus = "active";
                              displayStatus = "Active";
                            }
                          }

                          return (
                            <motion.tr
                              key={prospect.id}
                              layout
                              initial={{ opacity: 0, scale: 0.98, y: -6 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ 
                                opacity: 0, 
                                scale: 0.96, 
                                x: -24, 
                                transition: { duration: 0.22, ease: "easeOut" } 
                              }}
                              transition={{ 
                                type: "spring", 
                                stiffness: 450, 
                                damping: 32, 
                                mass: 0.8 
                              }}
                              className="group cursor-default hover:bg-muted/30 border-b transition-colors"
                            >
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  <Avatar className="h-9 w-9 border border-border shadow-sm group-hover:scale-105 transition-transform">
                                    <AvatarFallback className="bg-primary/5 text-primary text-xs font-medium">
                                      {prospect.name
                                        .split(" ")
                                        .map((n) => n[0])
                                        .join("")
                                        .substring(0, 2)
                                        .toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex flex-col">
                                    <span className="font-medium text-foreground">
                                      {highlightMatch(prospect.name, search)}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      {highlightMatch(prospect.email, search)}
                                    </span>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {highlightMatch(prospect.company || "—", search)}
                              </TableCell>
                              <TableCell>
                                {(prospect.campaign || prospect.source === "SMART_IMPORT") ? (
                                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50/80 border border-indigo-100/50 text-indigo-600 text-[11px] font-medium tracking-tight whitespace-nowrap">
                                    <Sparkles className="h-3 w-3 text-indigo-500" />
                                    Smart Import
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground text-xs font-medium">Manual</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <StatusBadge
                                  status={prospectBadgeStatus as any}
                                  label={displayStatus}
                                  dot
                                />
                              </TableCell>
                              <TableCell>
                                <StatusBadge
                                  status={sequenceBadgeStatus as any}
                                  label={sequenceLabel}
                                />
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {lastActivity
                                  ? format(new Date(lastActivity), "MMM d, yyyy")
                                  : "Never"}
                              </TableCell>
                              <TableCell className="text-right">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                      <span className="sr-only">Open menu</span>
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem asChild>
                                      <FastLink
                                        href={`/prospects/${prospect.id}`}
                                        className="cursor-pointer"
                                      >
                                        <ExternalLink className="mr-2 h-4 w-4" />
                                        View Profile
                                      </FastLink>
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() =>
                                        handleDeleteProspect(
                                          prospect.id,
                                          prospect.name,
                                        )
                                      }
                                      className="text-red-600 focus:text-red-600 focus:bg-red-50 cursor-pointer"
                                    >
                                      <Trash className="mr-2 h-4 w-4" />
                                      Delete Prospect
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </motion.tr>
                          );
                        })}
                      </AnimatePresence>
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={!!prospectToDelete}
        onOpenChange={(open) => !open && setProspectToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Prospect?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <strong>{prospectToDelete?.name}</strong>? All their sequence history and replies will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteProspect}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Prospect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

import { Suspense } from "react";

export default function ProspectsPage() {
  return (
    <Suspense fallback={<div className="p-8">Loading Prospects...</div>}>
      <ProspectsPageContent />
    </Suspense>
  );
}
