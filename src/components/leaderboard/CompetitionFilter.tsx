"use client";

import { useRouter, useSearchParams } from "next/navigation";

interface CompetitionFilterProps {
  competitions: { slug: string; name: string }[];
  selectedSlug?: string;
}

/** Narrows the leaderboard to a single competition without losing the current period tab. */
export function CompetitionFilter({ competitions, selectedSlug }: CompetitionFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleChange(slug: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (slug) params.set("competition", slug);
    else params.delete("competition");
    router.push(`/leaderboard?${params.toString()}`);
  }

  return (
    <select
      value={selectedSlug ?? ""}
      onChange={(e) => handleChange(e.target.value)}
      aria-label="Filter leaderboard by competition"
      className="rounded-md border border-border bg-surface-secondary px-3 py-1.5 text-sm text-text-primary focus:border-gold/60"
    >
      <option value="">All competitions</option>
      {competitions.map((c) => (
        <option key={c.slug} value={c.slug}>
          {c.name}
        </option>
      ))}
    </select>
  );
}
