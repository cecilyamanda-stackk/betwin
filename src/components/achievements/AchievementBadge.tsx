interface AchievementBadgeProps {
  icon: string;
  name: string;
  description: string;
  earned: boolean;
  earnedAt?: string | null;
}

/** Single achievement tile — dimmed/locked until earned (section 17). */
export function AchievementBadge({ icon, name, description, earned, earnedAt }: AchievementBadgeProps) {
  return (
    <div className={`card flex items-start gap-3 p-4 ${earned ? "" : "opacity-50"}`}>
      <span className="text-2xl" aria-hidden="true">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="font-medium text-text-primary">{name}</p>
        <p className="text-xs text-text-secondary">{description}</p>
        {earned && earnedAt && (
          <p className="mt-1 text-[11px] font-medium text-gold">
            Earned {new Date(earnedAt).toLocaleDateString()}
          </p>
        )}
        {!earned && <p className="mt-1 text-[11px] text-text-secondary">Locked</p>}
      </div>
    </div>
  );
}
