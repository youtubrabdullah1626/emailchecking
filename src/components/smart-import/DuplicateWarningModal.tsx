"use client";

import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle, Mail } from "lucide-react";

interface DuplicateItem {
  email: string;
  subject: string;
  lastSentAt: string | null;
}

interface DuplicateWarningModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  duplicates: DuplicateItem[];
  onConfirm: (selectedEmailsToKeep: string[]) => void;
}

export function DuplicateWarningModal({
  isOpen,
  onOpenChange,
  duplicates,
  onConfirm
}: DuplicateWarningModalProps) {
  // We track which emails the user wants to KEEP (i.e., force resend).
  // Default is empty (none selected = skip all duplicates).
  const [selectedToKeep, setSelectedToKeep] = useState<Set<string>>(new Set());

  const handleToggle = (email: string) => {
    const next = new Set(selectedToKeep);
    if (next.has(email)) {
      next.delete(email);
    } else {
      next.add(email);
    }
    setSelectedToKeep(next);
  };

  const handleSelectAll = () => {
    if (selectedToKeep.size === duplicates.length) {
      setSelectedToKeep(new Set()); // deselect all
    } else {
      setSelectedToKeep(new Set(duplicates.map(d => d.email))); // select all
    }
  };

  const handleConfirm = () => {
    onConfirm(Array.from(selectedToKeep));
    onOpenChange(false);
  };

  const allSelected = duplicates.length > 0 && selectedToKeep.size === duplicates.length;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="h-5 w-5" />
            Duplicate Emails Detected ({duplicates.length})
          </DialogTitle>
          <DialogDescription>
            You have already sent this exact message to the following prospects. 
            By default, they are safely <b>skipped</b>. If you intentionally want to send it again, select them below.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          <div className="flex justify-between items-center mb-2 px-1">
            <span className="text-sm font-medium">Review Duplicates</span>
            <Button variant="ghost" size="sm" onClick={handleSelectAll} className="h-8 text-xs">
              {allSelected ? "Deselect All" : "Select All"}
            </Button>
          </div>
          
          <ScrollArea className="h-[250px] rounded-md border border-border bg-muted/10 p-2">
            <div className="space-y-2">
              {duplicates.map((dup) => {
                const dateStr = dup.lastSentAt 
                  ? new Date(dup.lastSentAt).toLocaleDateString()
                  : "previously";

                return (
                  <div key={dup.email} className="flex items-start space-x-3 p-2 hover:bg-muted/30 rounded-md transition-colors">
                    <Checkbox 
                      id={`chk-${dup.email}`} 
                      checked={selectedToKeep.has(dup.email)}
                      onCheckedChange={() => handleToggle(dup.email)}
                      className="mt-1"
                    />
                    <div className="grid gap-1 leading-none cursor-pointer flex-1" onClick={() => handleToggle(dup.email)}>
                      <label htmlFor={`chk-${dup.email}`} className="text-sm font-medium leading-none cursor-pointer">
                        {dup.email}
                      </label>
                      <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <Mail className="h-3 w-3" />
                        <span className="truncate max-w-[300px]">&quot;{dup.subject}&quot;</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        Sent {dateStr}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter className="mt-4 gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel Import
          </Button>
          <Button onClick={handleConfirm} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            Confirm & Send ({selectedToKeep.size} selected)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
