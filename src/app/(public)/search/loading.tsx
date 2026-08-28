import { Skeleton, ListSkeleton } from "@/components/ui/LoadingSkeleton";

export default function SearchLoading() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-7 w-32" />
      <ListSkeleton rows={5} />
    </div>
  );
}
