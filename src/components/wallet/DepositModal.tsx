"use client";

import { Modal } from "@/components/ui/Modal";
import { MpesaDepositForm } from "./MpesaDepositForm";
import type { MpesaPaymentConfig } from "@/lib/mpesa";

interface DepositModalProps {
  config: MpesaPaymentConfig;
  onClose: () => void;
}

/**
 * Header's Deposit entry point (Phase 4). Wraps the manual M-Pesa
 * deposit form (see MpesaDepositForm) — no request history shown here,
 * since that lives on the full /account/wallet page; this is just the
 * quick "submit a payment" path from anywhere in the app.
 */
export function DepositModal({ config, onClose }: DepositModalProps) {
  return (
    <Modal open onClose={onClose} title="Deposit">
      <MpesaDepositForm config={config} />
    </Modal>
  );
}
