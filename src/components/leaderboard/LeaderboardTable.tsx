import { FollowButton } from "@/components/social/FollowButton";

export interface LeaderboardRow {
  userId: string;
  username: string;
  displayName: string | null;
  points: number;
}

interface LeaderboardTableProps {
  rows: LeaderboardRow[];
  /** When provided, the caller's own row is highlighted and Follow buttons are shown on every other row. */
  currentUserId?: string;
  followingIds?: Set<string>;
}

/** Ranked standings table (section 19) — Global/Weekly/Monthly/Friends/Competition all share this. */
export function LeaderboardTable({ rows, currentUserId, followingIds }: LeaderboardTableProps) {
  return (
    <div className="card overflow-x-auto p-0">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wide text-text-secondary">
            <th className="px-4 py-3 font-medium">#</th>
            <th className="px-4 py-3 font-medium">Player</th>
            <th className="px-4 py-3 text-right font-medium">Points</th>
            {currentUserId && <th className="px-4 py-3" />}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={row.userId}
              className={`border-b border-border/60 last:border-0 ${
                row.userId === currentUserId ? "bg-gold/10" : ""
              }`}
            >
              <td className="px-4 py-3 text-text-secondary">{i + 1}</td>
              <td className="px-4 py-3 text-text-primary">{row.displayName || row.username}</td>
              <td className="px-4 py-3 text-right font-semibold text-text-primary">{row.points}</td>
              {currentUserId && (
                <td className="px-4 py-3 text-right">
                  {row.userId !== currentUserId && (
                    <FollowButton userId={row.userId} initiallyFollowing={followingIds?.has(row.userId) ?? false} />
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
