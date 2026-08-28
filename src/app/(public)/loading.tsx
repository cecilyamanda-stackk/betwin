import { Skeleton, EventCardGridSkeleton, TableSkeleton } from "@/components/ui/LoadingSkeleton";

/** Mirrors HomePage's five sections so the layout doesn't jump once data arrives. */
export default function HomeLoading() {
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-2">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-96" />
      </section>

      <SectionSkeleton title="Live Now">
        <EventCardGridSkeleton count={4} />
      </SectionSkeleton>
      <SectionSkeleton title="Featured Events">
        <EventCardGridSkeleton count={3} columns="sm:grid-cols-2 lg:grid-cols-3" />
      </SectionSkeleton>
      <SectionSkeleton title="Popular Competitions">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </SectionSkeleton>
      <SectionSkeleton title="Upcoming Events">
        <EventCardGridSkeleton count={3} columns="sm:grid-cols-2 lg:grid-cols-3" />
      </SectionSkeleton>
      <SectionSkeleton title="Leaderboard Preview">
        <TableSkeleton rows={5} columns={3} />
      </SectionSkeleton>
    </div>
  );
}

function SectionSkeleton({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 font-display text-lg font-semibold text-text-secondary">{title}</h2>
      {children}
    </section>
  );
}
