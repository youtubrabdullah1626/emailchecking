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
import { CheckCircle } from "lucide-react";

interface UnblockUserDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  userName: string;
}

export function UnblockUserDialog({ isOpen, onClose, onConfirm, userName }: UnblockUserDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm();
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
            <div className="p-2 bg-emerald-500/10 text-emerald-600 rounded-full">
              <CheckCircle className="h-5 w-5" />
            </div>
            <DialogTitle>Restore Account Access</DialogTitle>
          </div>
          <DialogDescription className="pt-4">
            You are about to restore access for <strong>{userName}</strong>. They will be able to log in and resume their email campaigns immediately.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="sm:justify-start pt-4 flex gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={isSubmitting} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            Yes, Restore Access
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
