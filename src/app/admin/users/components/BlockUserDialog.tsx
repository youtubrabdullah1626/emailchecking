"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ShieldAlert } from "lucide-react";

interface BlockUserDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onBlock: (type: "temporary" | "permanent") => void;
  userName: string;
}

export function BlockUserDialog({ isOpen, onClose, onBlock, userName }: BlockUserDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleBlock = async (type: "temporary" | "permanent") => {
    setIsSubmitting(true);
    try {
      await onBlock(type);
    } finally {
      setIsSubmitting(false);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-destructive/10 text-destructive rounded-full">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <DialogTitle>Block User Account</DialogTitle>
          </div>
          <DialogDescription className="pt-4">
            You are about to block <strong>{userName}</strong>. This will instantly halt any active campaigns and terminate their current session. 
            Please select the type of block:
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-4">
          <Button 
            variant="outline" 
            className="flex flex-col items-start h-auto p-4 border-amber-200 bg-amber-50/50 hover:bg-amber-50 whitespace-normal text-left"
            onClick={() => handleBlock("temporary")}
            disabled={isSubmitting}
          >
            <div className="flex items-center gap-2 text-amber-700 font-semibold mb-1">
              <ShieldAlert className="h-4 w-4" />
              Temporary Block (Suspend)
            </div>
            <span className="text-sm text-muted-foreground font-normal">
              The account is suspended. Campaigns are paused and login is blocked, but you can easily restore access later.
            </span>
          </Button>

          <Button 
            variant="outline" 
            className="flex flex-col items-start h-auto p-4 border-destructive/30 bg-destructive/5 hover:bg-destructive/10 whitespace-normal text-left"
            onClick={() => handleBlock("permanent")}
            disabled={isSubmitting}
          >
            <div className="flex items-center gap-2 text-destructive font-semibold mb-1">
              <AlertTriangle className="h-4 w-4" />
              Permanent Block (Ban)
            </div>
            <span className="text-sm text-muted-foreground font-normal">
              The account is banned permanently. Active tokens are purged. This action is extremely difficult to reverse.
            </span>
          </Button>
        </div>

        <DialogFooter className="sm:justify-start">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
