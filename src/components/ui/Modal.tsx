"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { createPortal } from "react-dom";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

/**
 * Generic floating modal: dimmed overlay, ESC to close, click-outside to
 * close, focus moved to the dialog on open. Portaled to document.body so
 * it always floats above the sticky header/sidebar regardless of where
 * it's rendered from.
 */
export function Modal({ open, onClose, title, children }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Focus the dialog exactly once per open — not on every render where
  // `onClose` happens to get a new identity (callers often pass it
  // inline, e.g. `onCancel={() => setX(null)}`, which is recreated on
  // every parent render). Depending on `onClose` here would steal focus
  // back to the dialog container on every keystroke in any input inside
  // it, since typing triggers a parent re-render.
  useEffect(() => {
    if (!open) return;
    dialogRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="card relative z-10 w-full max-w-sm p-6 outline-none modal-in"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 text-text-secondary transition-colors hover:text-text-primary"
        >
          <X className="h-5 w-5" />
        </button>
        {children}
      </div>
    </div>,
    document.body
  );
}