interface EmptyStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

/** Polished empty state (section 36) — never show a blank section. */
export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="card flex flex-col items-center gap-2 px-6 py-10 text-center">
      <p className="font-medium text-text-primary">{title}</p>
      {description && <p className="max-w-sm text-sm text-text-secondary">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
