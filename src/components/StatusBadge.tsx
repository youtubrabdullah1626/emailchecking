/**
 * StatusBadge — displays a styled chip for ProspectStatus or SequenceStatus.
 *
 * Both enums share the same values (ACTIVE, STOPPED, COMPLETED, DRAFT/REPLIED).
 * The badge maps known values to colours and falls back gracefully for unknowns.
 */

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  // Prospect statuses
  ACTIVE:      { label: "Active",      className: "chip chip-active"    },
  UNCONTACTED: { label: "Uncontacted", className: "chip chip-pending bg-slate-100 text-slate-600 border-slate-200" },
  REPLIED:     { label: "Replied",     className: "chip chip-replied"   },
  STOPPED:     { label: "Stopped",     className: "chip chip-stopped"   },
  COMPLETED:   { label: "Completed",   className: "chip chip-completed" },
  // Sequence-only status
  DRAFT:     { label: "Draft",     className: "chip chip-pending"   },
};

interface StatusBadgeProps {
  /** Any status string — ProspectStatus, SequenceStatus, or StepStatus. */
  status: string;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? {
    label: status.charAt(0) + status.slice(1).toLowerCase(),
    className: "chip chip-pending",
  };

  return <span className={config.className}>{config.label}</span>;
}
