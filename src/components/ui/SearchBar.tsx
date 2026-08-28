"use client";

import { Search } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Global search input (header, section 8 & 30). Wired up to /search in
 * Phase 3 once teams/competitions/events exist to search across — for now
 * it just routes to a placeholder results page.
 */
export function SearchBar() {
  const [query, setQuery] = useState("");
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    router.push(`/search?q=${encodeURIComponent(query.trim())}`);
  }

  return (
    <form onSubmit={handleSubmit} className="relative w-full max-w-md">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary"
        aria-hidden="true"
      />
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search teams, competitions or matches..."
        aria-label="Search teams, competitions or matches"
        className="w-full rounded-md border border-border bg-surface-secondary py-2 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-secondary focus:border-gold/60"
      />
    </form>
  );
}
