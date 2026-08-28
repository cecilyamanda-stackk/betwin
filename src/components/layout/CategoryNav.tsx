interface Category {
  id: string;
  label: string;
}

interface CategoryNavProps {
  /** Populated from the sports/competitions tables in Phase 2. */
  categories?: Category[];
  activeId?: string;
}

/**
 * Horizontal pill row directly under the header (section 9). Renders
 * nothing until real sports/competitions exist — an empty row here would
 * just be dead chrome, which violates the "avoid blank screens without
 * explanation" rule less than showing fake sports would violate honesty.
 */
export function CategoryNav({ categories = [], activeId }: CategoryNavProps) {
  if (categories.length === 0) return null;

  return (
    <nav aria-label="Sport categories" className="border-b border-border bg-surface">
      <div className="mx-auto flex max-w-[1440px] gap-2 overflow-x-auto px-4 py-3 md:px-6">
        {categories.map((c) => (
          <button
            key={c.id}
            className={`pill whitespace-nowrap ${c.id === activeId ? "pill-selected" : ""}`}
            aria-current={c.id === activeId ? "true" : undefined}
          >
            {c.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
