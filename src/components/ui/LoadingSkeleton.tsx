export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-surface-secondary ${className}`} />;
}

/** Matches the shape of EventCard (section 13) so layout doesn't jump on load. */
export function EventCardSkeleton() {
  return (
    <div className="card flex flex-col gap-3 p-4">
      <Skeleton className="h-3 w-24" />
      <div className="flex items-center justify-between">
        <Skeleton className="h-10 w-20" />
        <Skeleton className="h-4 w-6" />
        <Skeleton className="h-10 w-20" />
      </div>
      <Skeleton className="h-8 w-full" />
    </div>
  );
}

/** Grid of EventCardSkeletons — homepage rails, /sports/[sport], /competitions/[competition], /live. */
export function EventCardGridSkeleton({ count = 4, columns = "sm:grid-cols-2 lg:grid-cols-4" }: { count?: number; columns?: string }) {
  return (
    <div className={`grid grid-cols-1 gap-4 ${columns}`}>
      {Array.from({ length: count }).map((_, i) => (
        <EventCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** Matches AdminTable's row shape (section 42) — every /admin/* list page. */
export function TableSkeleton({ rows = 6, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="card overflow-hidden p-0">
      <div className="border-b border-border px-4 py-3">
        <div className="flex gap-6">
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={i} className="h-3 w-16" />
          ))}
        </div>
      </div>
      <div className="divide-y divide-border/60">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex gap-6 px-4 py-4">
            {Array.from({ length: columns }).map((_, c) => (
              <Skeleton key={c} className="h-4 w-20" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Admin dashboard / homepage-style stat card row. */
export function StatCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card flex flex-col gap-2 p-4">
          <Skeleton className="h-7 w-12" />
          <Skeleton className="h-3 w-20" />
        </div>
      ))}
    </div>
  );
}

/** A short page title + one-line description, for pages whose header is itself data-driven. */
export function PageHeaderSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-4 w-72" />
    </div>
  );
}

/** /profile, /profile/settings — avatar + a few field-shaped rows. */
export function ProfileSkeleton() {
  return (
    <div className="card flex flex-col gap-4 p-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-16 w-16 rounded-full" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <Skeleton className="h-px w-full" />
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  );
}

/** Vertical list of card-shaped rows — /predictions, /predictions/history, /challenges, notifications. */
export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="card flex items-center justify-between gap-4 p-4">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-4 w-14 shrink-0" />
        </div>
      ))}
    </div>
  );
}
