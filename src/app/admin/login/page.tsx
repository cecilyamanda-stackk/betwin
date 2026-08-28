"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BrandLogo } from "@/components/layout/BrandLogo";
import { FormField } from "@/components/ui/FormField";

/**
 * Admin sign-in. Uses the same Supabase Auth as the public login — the
 * ADMIN/SUPER_ADMIN role check happens in middleware.ts and again
 * server-side on every admin data call, not here. This form only
 * authenticates; it never claims to authorize.
 *
 * `useSearchParams()` (for `?redirectTo=`) requires a Suspense boundary
 * around whatever calls it, or `next build`'s static export step fails
 * outright (Phase 5 build-correctness fix) — the form itself is split out
 * into `AdminLoginForm` so this file can wrap it in `<Suspense>`.
 */
export default function AdminLoginPage() {
  return (
    <Suspense fallback={<AdminLoginFallback />}>
      <AdminLoginForm />
    </Suspense>
  );
}

function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError || !data.user) {
      setLoading(false);
      setError("Incorrect email or password.");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();

    setLoading(false);

    if (!profile || (profile.role !== "ADMIN" && profile.role !== "SUPER_ADMIN")) {
      setError("This account does not have admin access.");
      await supabase.auth.signOut();
      return;
    }

    const redirectTo = searchParams.get("redirectTo") ?? "/admin/dashboard";
    router.push(redirectTo);
    router.refresh();
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center px-4">
      <BrandLogo />
      <p className="mt-2 text-xs font-semibold uppercase tracking-widest text-text-secondary">Admin</p>
      <h1 className="mt-2 font-display text-xl font-bold">Sign in</h1>

      <form onSubmit={handleSubmit} className="mt-6 flex w-full flex-col gap-4">
        <FormField label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" required />
        <FormField
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          required
        />

        {error && (
          <p role="alert" className="text-sm text-live">
            {error}
          </p>
        )}

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}

function AdminLoginFallback() {
  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center px-4">
      <BrandLogo />
    </div>
  );
}
