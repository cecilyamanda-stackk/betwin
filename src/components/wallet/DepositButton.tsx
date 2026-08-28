"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { DepositModal } from "./DepositModal";
import type { MpesaPaymentConfig } from "@/lib/mpesa";

/**
 * Header's Deposit entry point. Split from Header (a server component)
 * for the modal's client state, same pattern as AuthButtons/AuthModal.
 */
export function DepositButton({ mpesaConfig }: { mpesaConfig: MpesaPaymentConfig }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-primary flex shrink-0 items-center gap-1 px-2.5 py-1.5 text-xs sm:px-3 sm:py-2 sm:text-sm"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="hidden sm:inline">Deposit</span>
      </button>

      {open && <DepositModal config={mpesaConfig} onClose={() => setOpen(false)} />}
    </>
  );
}
