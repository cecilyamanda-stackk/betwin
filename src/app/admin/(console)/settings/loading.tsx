import { Skeleton } from "@/components/ui/LoadingSkeleton";

export default function AdminSettingsLoading() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-7 w-32" />
      <Skeleton className="h-24 w-full max-w-md" />
      <Skeleton className="h-24 w-full max-w-md" />
    </div>
  );
}
