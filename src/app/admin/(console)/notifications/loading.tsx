import { Skeleton, ListSkeleton } from "@/components/ui/LoadingSkeleton";

export default function AdminNotificationsLoading() {
  return (
    <div>
      <Skeleton className="mb-6 h-7 w-48" />
      <ListSkeleton rows={5} />
    </div>
  );
}
