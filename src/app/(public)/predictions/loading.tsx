import { Skeleton, ListSkeleton } from "@/components/ui/LoadingSkeleton";

export default function PredictionsLoading() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-7 w-40" />
      <ListSkeleton rows={5} />
    </div>
  );
}
