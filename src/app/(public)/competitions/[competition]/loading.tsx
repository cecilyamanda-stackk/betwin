import { Skeleton, EventCardGridSkeleton } from "@/components/ui/LoadingSkeleton";

export default function CompetitionDetailLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-40" />
      </div>
      <EventCardGridSkeleton count={6} columns="sm:grid-cols-2 lg:grid-cols-3" />
    </div>
  );
}
