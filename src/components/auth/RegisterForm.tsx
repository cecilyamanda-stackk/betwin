"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { FormField } from "@/components/ui/FormField";
import { PasswordField } from "@/components/ui/PasswordField";

interface RegisterFormProps {
  /** Called only when Supabase returns an immediate session (email confirmation disabled). */
  onSuccess: () => void;
  onSwitchToLogin?: () => void;
}

export function RegisterForm({ onSuccess, onSwitchToLogin }: RegisterFormProps) {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  // null = still checking; this way a slow network doesn't flash the
  // "closed" message before the setting has actually loaded.
  const [registrationEnabled, setRegistrationEnabled] = useState<boolean | null>(null);

  // platform_settings.registration_enabled (Phase 4, /admin/settings) is
  // readable by anon/authenticated via RLS, so this checks it directly
  // rather than needing a Server Action just to read one flag. Covers
  // both the standalone /auth/register page and the header's AuthModal,
  // since both render this same component.
  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "registration_enabled")
      .single()
      .then(({ data }) => {
        if (!cancelled) setRegistrationEnabled(data ? Boolean(data.value) : true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    const supabase = createClient();
    // `phone` goes through options.data (raw_user_meta_data) — it's just a
    // profile attribute here, not signUp's top-level `phone` field, which
    // is for SMS/OTP-based auth identity (a different, unused feature).
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { phone } },
    });

    setLoading(false);
    if (error) {
      // TEMP DEBUG: remove once the real cause is confirmed.
      console.error("Supabase signUp error:", error);
      setError(
        error.message === "User already registered"
          ? "An account with this email already exists."
          : "We couldn't create your account. Please try again."
      );
      return;
    }

    if (data.session) {
      onSuccess();
    } else {
      setSubmitted(true);
    }
  }

  if (registrationEnabled === false) {
    return (
      <div className="flex w-full flex-col items-center text-center">
        <h1 className="font-display text-xl font-bold">Registration is closed</h1>
        <p className="mt-2 text-sm text-text-secondary">
          New sign-ups are temporarily paused. Please check back later.
        </p>
        {onSwitchToLogin ? (
          <button type="button" onClick={onSwitchToLogin} className="mt-4 text-gold hover:text-gold-hover">
            Already have an account? Log in
          </button>
        ) : (
          <a href="/auth/login" className="mt-4 text-gold hover:text-gold-hover">
            Already have an account? Log in
          </a>
        )}
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex w-full flex-col items-center text-center">
        <h1 className="font-display text-xl font-bold">Check your email</h1>
        <p className="mt-2 text-sm text-text-secondary">
          We sent a confirmation link to {email}. Follow it to activate your account.
        </p>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col items-center">
      <h1 className="font-display text-xl font-bold">Create your account</h1>

      <form onSubmit={handleSubmit} className="mt-6 flex w-full flex-col gap-4">
        <FormField label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" required />
        <FormField label="Phone number" type="tel" value={phone} onChange={setPhone} autoComplete="tel" required />
        <PasswordField
          label="Password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          required
          minLength={8}
        />
        <PasswordField
          label="Confirm password"
          value={confirmPassword}
          onChange={setConfirmPassword}
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
          {loading ? "Creating account..." : "Create account"}
        </button>
      </form>

      <p className="mt-4 text-sm text-text-secondary">
        Already have an account?{" "}
        {onSwitchToLogin ? (
          <button type="button" onClick={onSwitchToLogin} className="text-gold hover:text-gold-hover">
            Log in
          </button>
        ) : (
          <a href="/auth/login" className="text-gold hover:text-gold-hover">
            Log in
          </a>
        )}
      </p>
    </div>
  );
}
