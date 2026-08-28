interface TeamDisplayProps {
  name: string;
  shortName?: string | null;
}

/**
 * Team badge + name (section 42). No logo_url artwork exists for demo
 * teams, so the badge falls back to an initials chip rather than a
 * broken/placeholder image — never fake a crest.
 */
export function TeamDisplay({ name, shortName }: TeamDisplayProps) {
  const initials = (shortName || name).slice(0, 3).toUpperCase();

  return (
    <div className="flex flex-col items-center gap-1.5 text-center">
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-secondary text-xs font-bold text-text-secondary"
        aria-hidden="true"
      >
        {initials}
      </div>
      <span className="max-w-[92px] truncate text-xs font-medium text-text-primary">{name}</span>
    </div>
  );
}
