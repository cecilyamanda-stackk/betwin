import { Skeleton, EventCardGridSkeleton } from "@/components/ui/LoadingSkeleton";

export default function LiveLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-72" />
      </div>
      <EventCardGridSkeleton count={4} />
    </div>
  );
}
