"use client";

import { Modal } from "@/components/ui/Modal";

interface AdminFormProps {
  open: boolean;
  onClose: () => void;
  title: string;
  onSubmit: (e: React.FormEvent) => void;
  loading: boolean;
  error: string | null;
  submitLabel: string;
  children: React.ReactNode;
  size?: "sm" | "lg";
}

/**
 * Shared shell for every admin create/edit form (section 42): floats as a
 * Modal, shows a single error line, disables the submit button while a
 * Server Action is in flight. Individual pages only supply the fields.
 */
export function AdminForm({
  open,
  onClose,
  title,
  onSubmit,
  loading,
  error,
  submitLabel,
  children,
  size,
}: AdminFormProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} size={size}>
      <h2 className="mb-4 font-display text-lg font-bold text-text-primary">{title}</h2>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {children}

        {error && (
          <p role="alert" className="text-sm text-live">
            {error}
          </p>
        )}

        <div className="mt-1 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? "Saving..." : submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}

interface AdminSelectProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  required?: boolean;
}

/** Labeled <select>, styled to match FormField's <input>. */
export function AdminSelect({
  label,
  value,
  onChange,
  options,
  placeholder = "Select...",
  required,
}: AdminSelectProps) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="text-text-secondary">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="rounded-md border border-border bg-surface-secondary px-3 py-2 text-text-primary focus:border-gold/60"
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

interface AdminCheckboxProps {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}

export function AdminCheckbox({ label, checked, onChange }: AdminCheckboxProps) {
  return (
    <label className="flex items-center gap-2 text-sm text-text-secondary">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-border bg-surface-secondary accent-gold"
      />
      {label}
    </label>
  );
}
