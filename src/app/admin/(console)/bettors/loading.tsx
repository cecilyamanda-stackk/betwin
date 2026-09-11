import { Skeleton } from "@/components/ui/LoadingSkeleton";

export default function AdminLoading() {
  return (
    <div>
      <Skeleton className="mb-6 h-7 w-40" />
      <div className="mb-6 flex gap-2 overflow-x-auto">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-32 shrink-0 rounded-pill" />
        ))}
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="mb-4 h-48 rounded-card" />
      ))}
    </div>
  );
}
