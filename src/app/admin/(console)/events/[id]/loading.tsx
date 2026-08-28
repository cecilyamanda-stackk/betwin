import { Skeleton, TableSkeleton } from "@/components/ui/LoadingSkeleton";

export default function AdminEventDetailLoading() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-7 w-64" />
      <TableSkeleton rows={4} columns={3} />
    </div>
  );
}
