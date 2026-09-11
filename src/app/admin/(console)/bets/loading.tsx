import { Skeleton, TableSkeleton } from "@/components/ui/LoadingSkeleton";

export default function AdminLoading() {
  return (
    <div>
      <Skeleton className="mb-6 h-7 w-40" />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-card" />
        ))}
      </div>
      <Skeleton className="mb-6 h-40 rounded-card" />
      <TableSkeleton rows={8} />
    </div>
  );
}
