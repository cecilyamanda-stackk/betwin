import { Skeleton, ListSkeleton } from "@/components/ui/LoadingSkeleton";

export default function PredictionHistoryLoading() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-7 w-48" />
      <ListSkeleton rows={6} />
    </div>
  );
}
