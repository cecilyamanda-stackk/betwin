import { Skeleton, StatCardsSkeleton } from "@/components/ui/LoadingSkeleton";

export default function AdminDashboardLoading() {
  return (
    <div>
      <Skeleton className="mb-6 h-7 w-32" />
      <StatCardsSkeleton count={7} />
    </div>
  );
}
