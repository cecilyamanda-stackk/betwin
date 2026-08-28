import Link from "next/link";

interface ChallengeCardProps {
  slug: string;
  name: string;
  description: string | null;
  startTime: string;
  endTime: string;
  entryCount: number;
  joined: boolean;
}

/** List-view tile for /challenges (section 19's mini-leaderboard groupings). */
export function ChallengeCard({ slug, name, description, startTime, endTime, entryCount, joined }: ChallengeCardProps) {
  return (
    <Link href={`/challenges/${slug}`} className="card flex flex-col gap-2 p-4 transition-colors hover:border-gold/40">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display text-base font-semibold text-text-primary">{name}</h3>
        {joined && <span className="pill pill-selected shrink-0 !py-0.5 !px-2 text-[11px]">Joined</span>}
      </div>
      {description && <p className="text-sm text-text-secondary">{description}</p>}
      <div className="mt-1 flex items-center justify-between text-xs text-text-secondary">
        <span>
          {new Date(startTime).toLocaleDateString()} – {new Date(endTime).toLocaleDateString()}
        </span>
        <span>{entryCount} joined</span>
      </div>
    </Link>
  );
}
