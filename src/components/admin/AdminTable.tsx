import { EmptyState } from "@/components/ui/EmptyState";

export interface AdminTableColumn<T> {
  key: string;
  label: string;
  render: (row: T) => React.ReactNode;
  className?: string;
}

interface AdminTableProps<T> {
  columns: AdminTableColumn<T>[];
  rows: T[];
  keyField: (row: T) => string;
  onRowClick?: (row: T) => void;
  emptyTitle: string;
  emptyDescription?: string;
}

/**
 * Shared list view for every /admin/* catalogue page (section 42).
 *
 * Below `sm`, renders each row as a stacked label/value card instead of
 * the table — same data, no sideways scrolling to read a status column.
 * The table itself (with its `overflow-x-auto` wrapper) still renders at
 * `sm+`, unchanged.
 */
export function AdminTable<T>({
  columns,
  rows,
  keyField,
  onRowClick,
  emptyTitle,
  emptyDescription,
}: AdminTableProps<T>) {
  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <>
      <div className="flex flex-col gap-3 sm:hidden">
        {rows.map((row) => (
          <div
            key={keyField(row)}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            className={`card flex flex-col gap-3 p-4 ${
              onRowClick ? "cursor-pointer hover:border-gold/50" : ""
            }`}
          >
            {columns.map((col) => (
              <div key={col.key} className="flex flex-col gap-0.5">
                <span className="text-xs font-medium uppercase tracking-wide text-text-secondary">
                  {col.label}
                </span>
                <div className={`text-sm text-text-primary ${col.className ?? ""}`}>{col.render(row)}</div>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="card hidden overflow-x-auto p-0 sm:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wide text-text-secondary">
              {columns.map((col) => (
                <th key={col.key} className={`px-4 py-3 font-medium ${col.className ?? ""}`}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={keyField(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={`border-b border-border/60 last:border-0 ${
                  onRowClick ? "cursor-pointer hover:bg-surface-secondary" : ""
                }`}
              >
                {columns.map((col) => (
                  <td key={col.key} className={`px-4 py-3 text-text-primary ${col.className ?? ""}`}>
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
