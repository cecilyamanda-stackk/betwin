import { Skeleton, TableSkeleton } from "@/components/ui/LoadingSkeleton";

export default function ChallengeDetailLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-80" />
      </div>
      <TableSkeleton rows={6} columns={3} />
    </div>
  );
}
