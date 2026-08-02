"use client";

import { useEffect, useRef } from "react";

interface DeleteConfirmDialogProps {
  /** The prospect's name — shown in the dialog */
  prospectName: string;
  /** Called when the user confirms deletion */
  onConfirm: () => void;
  /** Called when the user cancels */
  onCancel: () => void;
  /** Whether the delete operation is currently in progress */
  isDeleting?: boolean;
}

export default function DeleteConfirmDialog({
  prospectName,
  onConfirm,
  onCancel,
  isDeleting = false,
}: DeleteConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Focus the cancel button on mount (safe default for destructive dialogs)
  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !isDeleting) onCancel();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDeleting, onCancel]);

  return (
    <div
      className="dialog-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
      aria-describedby="dialog-desc"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isDeleting) onCancel();
      }}
    >
      <div className="dialog">
        <div className="dialog-icon">🗑️</div>

        <h2 className="dialog-title" id="dialog-title">
          Delete prospect?
        </h2>

        <p className="dialog-desc" id="dialog-desc">
          You are about to permanently delete{" "}
          <strong>{prospectName}</strong>.
          <br />
          This action cannot be undone.
        </p>

        <p className="dialog-warning">
          All associated data will be deleted with this prospect.
        </p>

        <div className="dialog-actions">
          <button
            ref={cancelRef}
            type="button"
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={isDeleting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting…" : "Yes, delete permanently"}
          </button>
        </div>
      </div>
    </div>
  );
}
