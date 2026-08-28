"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BrandLogo } from "@/components/layout/BrandLogo";
import { PasswordField } from "@/components/ui/PasswordField";

/**
 * Landed on from the reset-password email link. Supabase attaches a
 * recovery session to the browser automatically via the URL fragment
 * before this page renders, so updateUser just needs the new password.
 */
export default function ResetPasswordConfirmPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    setLoading(false);
    if (error) {
      setError("This link may have expired. Please request a new one.");
      return;
    }
    setDone(true);
    setTimeout(() => router.push("/"), 1500);
  }

  if (done) {
    return (
      <div className="mx-auto flex max-w-sm flex-col items-center px-4 py-16 text-center">
        <BrandLogo />
        <h1 className="mt-6 font-display text-xl font-bold">Password updated</h1>
        <p className="mt-2 text-sm text-text-secondary">Taking you back to the homepage...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col items-center px-4 py-16">
      <BrandLogo />
      <h1 className="mt-6 font-display text-xl font-bold">Set a new password</h1>

      <form onSubmit={handleSubmit} className="mt-6 flex w-full flex-col gap-4">
        <PasswordField
          label="New password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          required
          minLength={8}
        />

        {error && (
          <p role="alert" className="text-sm text-live">
            {error}
          </p>
        )}

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? "Updating..." : "Update password"}
        </button>
      </form>
    </div>
  );
}
