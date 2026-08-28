import { Skeleton } from "@/components/ui/LoadingSkeleton";

export default function SportsLoading() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-7 w-24" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
    </div>
  );
}
