"use client";

import { Modal } from "@/components/ui/Modal";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: React.ReactNode;
}

/** Confirmation modal for destructive/irreversible admin actions (section 42). */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  danger = false,
  loading = false,
  onConfirm,
  onCancel,
  children,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onCancel} title={title}>
      <h2 className="mb-2 font-display text-lg font-bold text-text-primary">{title}</h2>
      {description && <p className="mb-5 text-sm text-text-secondary">{description}</p>}
      {children}
      <div className="flex justify-end gap-3">
        <button type="button" onClick={onCancel} className="btn-secondary">
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={loading}
          className={
            danger
              ? "inline-flex items-center justify-center rounded-md bg-live px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-live/90 disabled:opacity-50"
              : "btn-primary"
          }
        >
          {loading ? "Working..." : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
