"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

interface PasswordFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
}

/** Password input with a show/hide (eye) toggle — used by login/register/settings forms. */
export function PasswordField({ label, value, onChange, autoComplete, required, minLength }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="text-text-secondary">{label}</span>
      <div className="relative">
        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          required={required}
          minLength={minLength}
          className="w-full rounded-md border border-border bg-surface-secondary px-3 py-2 pr-10 text-text-primary focus:border-gold/60"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          tabIndex={-1}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-text-secondary transition-colors hover:text-text-primary"
        >
          {visible ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>
    </label>
  );
}
