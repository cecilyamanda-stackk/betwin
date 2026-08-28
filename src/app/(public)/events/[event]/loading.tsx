import { Skeleton } from "@/components/ui/LoadingSkeleton";

/** Mirrors the event header + Overview card shape (section 13/14). */
export default function EventDetailLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-32" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-5 w-16 rounded-pill" />
        </div>
      </div>

      <div className="flex gap-1 border-b border-border pb-0">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-28" />
      </div>

      <div className="card flex items-center justify-between gap-4 p-6">
        <div className="flex flex-col items-center gap-1.5">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="h-7 w-20" />
        <div className="flex flex-col items-center gap-1.5">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
    </div>
  );
}
