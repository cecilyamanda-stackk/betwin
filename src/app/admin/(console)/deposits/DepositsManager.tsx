"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { resolveManualDepositRequest } from "@/actions/admin/wallet";
import type { ManualDepositStatus } from "@/types/database";
import { formatKES } from "@/lib/currency";

interface DepositRow {
  id: string;
  username: string;
  email: string;
  mpesaCode: string;
  mpesaPhone: string;
  claimedAmount: number;
  status: ManualDepositStatus;
  adminNote: string | null;
  createdAt: string;
}

const STATUS_STYLES: Record<ManualDepositStatus, string> = {
  PENDING: "text-gold",
  APPROVED: "text-success",
  REJECTED: "text-live",
};

export function DepositsManager({ requests }: { requests: DepositRow[] }) {
  const router = useRouter();
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pending = requests.filter((r) => r.status === "PENDING");
  const history = requests.filter((r) => r.status !== "PENDING");

  async function handleApprove(id: string) {
    setLoadingId(id);
    setError(null);
    const result = await resolveManualDepositRequest(id, true);
    setLoadingId(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  async function handleReject() {
    if (!rejectingId) return;
    setLoadingId(rejectingId);
    setError(null);
    const result = await resolveManualDepositRequest(rejectingId, false, rejectNote || undefined);
    setLoadingId(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    setRejectingId(null);
    setRejectNote("");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-8">
      {error && (
        <p role="alert" className="text-sm text-live">
          {error}
        </p>
      )}

      <section>
        <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wide text-text-secondary">
          Pending ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <EmptyState title="Nothing waiting on review." />
        ) : (
          <div className="flex flex-col gap-2">
            {pending.map((r) => (
              <div key={r.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-primary">
                    {r.username} <span className="font-normal text-text-secondary">({r.email})</span>
                  </p>
                  <p className="text-xs text-text-secondary">
                    <span className="font-mono text-text-primary">{r.mpesaCode}</span> · {r.mpesaPhone} ·{" "}
                    {formatKES(r.claimedAmount)} claimed
                  </p>
                  <p className="text-xs text-text-secondary">{new Date(r.createdAt).toLocaleString()}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => handleApprove(r.id)}
                    disabled={loadingId === r.id}
                    className="btn-primary px-3 py-1.5 text-xs"
                  >
                    {loadingId === r.id ? "Working..." : "Approve"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRejectingId(r.id)}
                    disabled={loadingId === r.id}
                    className="rounded-md bg-live px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-live/90 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {history.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wide text-text-secondary">
            History
          </h2>
          <div className="flex flex-col gap-2">
            {history.map((r) => (
              <div key={r.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="text-sm text-text-primary">
                    {r.username} — <span className="font-mono">{r.mpesaCode}</span> — {formatKES(r.claimedAmount)}
                  </p>
                  {r.adminNote && <p className="text-xs text-text-secondary">{r.adminNote}</p>}
                </div>
                <span className={`shrink-0 text-xs font-semibold uppercase ${STATUS_STYLES[r.status]}`}>
                  {r.status}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <ConfirmDialog
        open={rejectingId !== null}
        title="Reject deposit claim"
        description="Optionally explain why — the user will see this note."
        confirmLabel="Reject"
        danger
        loading={loadingId === rejectingId}
        onConfirm={handleReject}
        onCancel={() => {
          setRejectingId(null);
          setRejectNote("");
        }}
      >
        <textarea
          value={rejectNote}
          onChange={(e) => setRejectNote(e.target.value)}
          placeholder="e.g. Code doesn't match any payment received."
          rows={3}
          className="mb-4 w-full rounded-md border border-border bg-surface-secondary px-3 py-2 text-sm text-text-primary focus:border-gold/60"
        />
      </ConfirmDialog>
    </div>
  );
}
