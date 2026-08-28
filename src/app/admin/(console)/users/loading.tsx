import { Skeleton, TableSkeleton } from "@/components/ui/LoadingSkeleton";

export default function AdminLoading() {
  return (
    <div>
      <Skeleton className="mb-6 h-7 w-40" />
      <TableSkeleton rows={8} />
    </div>
  );
}
