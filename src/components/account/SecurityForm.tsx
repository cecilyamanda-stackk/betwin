"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Wagering roadmap Phase 6: "Security & 2FA — extends the existing
 * account-settings page." The existing page (/profile/settings) only
 * covers profile fields; password reset already existed as a standalone
 * flow (/auth/reset-password) but had no home inside account management,
 * so it's surfaced here.
 *
 * Two-factor authentication is not implemented — there's no MFA
 * enrollment flow (TOTP secret generation, QR code, backup codes) built
 * anywhere in this codebase yet. Rather than show a toggle that doesn't
 * do anything, this says so plainly; same pattern as every other
 * not-yet-live piece of the wagering system (deposits, etc.).
 */
export function SecurityForm({ email }: { email: string }) {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSendResetLink() {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password/confirm`,
    });
    setLoading(false);
    if (resetError) {
      setError("Couldn't send a reset link. Please try again.");
      return;
    }
    setSent(true);
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="card p-5">
        <h2 className="mb-1 font-display text-sm font-semibold text-text-primary">Password</h2>
        <p className="mb-4 text-xs text-text-secondary">
          Signed in as {email}. We&apos;ll email a reset link rather than changing it here directly.
        </p>
        {sent ? (
          <p className="text-sm text-success">Check your email for a reset link.</p>
        ) : (
          <button type="button" onClick={handleSendResetLink} disabled={loading} className="btn-secondary">
            {loading ? "Sending..." : "Send password reset link"}
          </button>
        )}
        {error && (
          <p role="alert" className="mt-2 text-sm text-live">
            {error}
          </p>
        )}
      </section>

      <section className="card p-5">
        <h2 className="mb-1 font-display text-sm font-semibold text-text-primary">Two-factor authentication</h2>
        <p className="text-xs text-text-secondary">
          Not available yet — there&apos;s no 2FA enrollment built into this account system. This section
          is here so it has a home once that&apos;s added, rather than bolting it on somewhere unrelated
          later.
        </p>
      </section>
    </div>
  );
}
