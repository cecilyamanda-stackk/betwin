"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { FormField } from "@/components/ui/FormField";
import { PasswordField } from "@/components/ui/PasswordField";

interface LoginFormProps {
  /** Called after a successful sign-in. Caller decides whether to close a modal, redirect, or both. */
  onSuccess: () => void;
  onSwitchToRegister?: () => void;
  onSwitchToReset?: () => void;
}

export function LoginForm({ onSuccess, onSwitchToRegister, onSwitchToReset }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);
    if (error) {
      setError("Incorrect email or password. Please try again.");
      return;
    }
    onSuccess();
  }

  return (
    <div className="flex w-full flex-col items-center">
      <h1 className="font-display text-xl font-bold">Log in</h1>

      <form onSubmit={handleSubmit} className="mt-6 flex w-full flex-col gap-4">
        <FormField label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" required />
        <PasswordField
          label="Password"
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
          {loading ? "Logging in..." : "Log in"}
        </button>
      </form>

      <div className="mt-4 flex w-full justify-between text-sm text-text-secondary">
        {onSwitchToReset ? (
          <button type="button" onClick={onSwitchToReset} className="hover:text-text-primary">
            Forgot password?
          </button>
        ) : (
          <a href="/auth/reset-password" className="hover:text-text-primary">
            Forgot password?
          </a>
        )}
        {onSwitchToRegister ? (
          <button type="button" onClick={onSwitchToRegister} className="hover:text-text-primary">
            Create an account
          </button>
        ) : (
          <a href="/auth/register" className="hover:text-text-primary">
            Create an account
          </a>
        )}
      </div>
    </div>
  );
}
