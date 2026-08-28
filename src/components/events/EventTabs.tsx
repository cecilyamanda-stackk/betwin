"use client";

import { useState } from "react";

interface Tab {
  id: string;
  label: string;
  content: React.ReactNode;
}

/**
 * Event detail tab strip (section 14). Content for each tab is rendered
 * server-side by the page and passed in as a node — this component only
 * owns which tab is active, so no client-side data fetching is needed.
 *
 * Only Overview and Predictions are wired up so far: Statistics, Lineups,
 * and Timeline have no backing schema yet (no stats/lineup/play-by-play
 * tables exist), and the project's rule is to never show a tab backed by
 * fake data. Add those tabs here once a later phase introduces real data
 * for them.
 */
export function EventTabs({ tabs }: { tabs: Tab[] }) {
  const [activeId, setActiveId] = useState(tabs[0]?.id);
  const active = tabs.find((t) => t.id === activeId) ?? tabs[0];

  return (
    <div>
      <div role="tablist" aria-label="Event details" className="mb-4 flex gap-1 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={tab.id === active?.id}
            onClick={() => setActiveId(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${
              tab.id === active?.id
                ? "border-b-2 border-gold text-text-primary"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {active?.content}
    </div>
  );
}
