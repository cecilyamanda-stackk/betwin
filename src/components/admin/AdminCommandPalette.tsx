"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { Search } from "lucide-react";
import { ADMIN_NAV } from "@/components/admin/AdminNavList";

/**
 * Cmd/Ctrl+K command palette for jumping straight to any admin page —
 * Phase 5 polish item, scoped to page navigation (the console's 14
 * catalog pages) rather than entity search, which would need its own
 * backend query per entity type.
 *
 * Opens on the global Cmd/Ctrl+K shortcut, or on the
 * "admin-command-palette:open" window event dispatched by AdminHeader's
 * search button (for anyone who wouldn't otherwise discover the
 * shortcut). Portaled to document.body like Modal.tsx/AdminMobileNav for
 * the same reason — needs to float above everything regardless of where
 * it's mounted from.
 */
export function AdminCommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const results = query.trim()
    ? ADMIN_NAV.filter((item) => item.label.toLowerCase().includes(query.trim().toLowerCase()))
    : ADMIN_NAV;

  useEffect(() => {
    function handleGlobalKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    function handleOpenEvent() {
      setOpen(true);
    }
    document.addEventListener("keydown", handleGlobalKeyDown);
    window.addEventListener("admin-command-palette:open", handleOpenEvent);
    return () => {
      document.removeEventListener("keydown", handleGlobalKeyDown);
      window.removeEventListener("admin-command-palette:open", handleOpenEvent);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveIndex(0);
    const frame = requestAnimationFrame(() => inputRef.current?.focus());

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  function navigateTo(href: string) {
    setOpen(false);
    router.push(href);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = results[activeIndex];
      if (target) navigateTo(target.href);
    }
  }

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[15vh]">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Jump to admin page"
        className="card modal-in relative z-10 w-full max-w-md overflow-hidden p-0"
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-text-secondary" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Jump to a page..."
            className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-secondary focus:outline-none"
          />
          <kbd className="hidden shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] text-text-secondary sm:inline">
            Esc
          </kbd>
        </div>
        <ul className="max-h-80 overflow-y-auto p-2">
          {results.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-text-secondary">No pages match &ldquo;{query}&rdquo;.</li>
          )}
          {results.map((item, i) => {
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <button
                  type="button"
                  onClick={() => navigateTo(item.href)}
                  onMouseEnter={() => setActiveIndex(i)}
                  className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                    i === activeIndex
                      ? "bg-surface-secondary text-text-primary"
                      : "text-text-secondary hover:bg-surface-secondary hover:text-text-primary"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>,
    document.body
  );
}
