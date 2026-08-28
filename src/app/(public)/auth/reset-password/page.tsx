"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { BrandLogo } from "@/components/layout/BrandLogo";
import { FormField } from "@/components/ui/FormField";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password/confirm`,
    });

    setLoading(false);
    if (error) {
      setError("We couldn't send a reset link. Please try again.");
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="mx-auto flex max-w-sm flex-col items-center px-4 py-16 text-center">
        <BrandLogo />
        <h1 className="mt-6 font-display text-xl font-bold">Check your email</h1>
        <p className="mt-2 text-sm text-text-secondary">
          If an account exists for {email}, a password reset link is on its way.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col items-center px-4 py-16">
      <BrandLogo />
      <h1 className="mt-6 font-display text-xl font-bold">Reset your password</h1>
      <p className="mt-2 text-center text-sm text-text-secondary">
        Enter your email and we&apos;ll send you a link to reset your password.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 flex w-full flex-col gap-4">
        <FormField label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" required />

        {error && (
          <p role="alert" className="text-sm text-live">
            {error}
          </p>
        )}

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? "Sending..." : "Send reset link"}
        </button>
      </form>
    </div>
  );
}
