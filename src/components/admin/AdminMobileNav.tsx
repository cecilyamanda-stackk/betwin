"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { createPortal } from "react-dom";
import { AdminNavList } from "@/components/admin/AdminNavList";

interface AdminMobileNavProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Slide-in nav drawer shown below `lg`, opened by AdminHeader's hamburger
 * button. Portaled to document.body for the same reason Modal.tsx already
 * is — it needs to float above the sticky header regardless of where it's
 * rendered from. Closes on Escape, backdrop click, or navigating to a link
 * (via AdminNavList's onNavigate), and locks body scroll while open,
 * mirroring Modal.tsx's existing behavior.
 */
export function AdminMobileNav({ open, onClose }: AdminMobileNavProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    panelRef.current?.focus();

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
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Admin navigation"
        tabIndex={-1}
        className="drawer-in relative z-10 flex h-full w-64 max-w-[80vw] flex-col gap-1 overflow-y-auto border-r border-border bg-surface px-3 py-4 outline-none"
      >
        <div className="mb-2 flex items-center justify-end px-1">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="text-text-secondary transition-colors hover:text-text-primary"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <AdminNavList onNavigate={onClose} />
      </div>
    </div>,
    document.body
  );
}
