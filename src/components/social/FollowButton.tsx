"use client";

import { useState, useTransition } from "react";
import { followUser, unfollowUser } from "@/actions/social";

interface FollowButtonProps {
  userId: string;
  initiallyFollowing: boolean;
}

/** Small follow/unfollow toggle used on leaderboard rows (section 19). */
export function FollowButton({ userId, initiallyFollowing }: FollowButtonProps) {
  const [following, setFollowing] = useState(initiallyFollowing);
  const [isPending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      const result = following ? await unfollowUser(userId) : await followUser(userId);
      if (!result.error) setFollowing(!following);
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={isPending}
      className={`rounded-pill px-3 py-1 text-xs font-semibold transition-colors disabled:opacity-50 ${
        following
          ? "border border-border text-text-secondary hover:border-gold/50"
          : "bg-gold text-background hover:bg-gold-hover"
      }`}
    >
      {following ? "Following" : "Follow"}
    </button>
  );
}
