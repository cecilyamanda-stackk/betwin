import { Skeleton, TableSkeleton } from "@/components/ui/LoadingSkeleton";

export default function LeaderboardLoading() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-7 w-40" />
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-20 rounded-pill" />
        ))}
      </div>
      <TableSkeleton rows={8} columns={3} />
    </div>
  );
}
