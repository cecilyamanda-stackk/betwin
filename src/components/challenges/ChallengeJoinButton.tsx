"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { joinChallenge, leaveChallenge } from "@/actions/challenges";

interface ChallengeJoinButtonProps {
  challengeId: string;
  slug: string;
  initiallyJoined: boolean;
  signedIn: boolean;
}

export function ChallengeJoinButton({ challengeId, slug, initiallyJoined, signedIn }: ChallengeJoinButtonProps) {
  const router = useRouter();
  const [joined, setJoined] = useState(initiallyJoined);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggle() {
    setError(null);
    startTransition(async () => {
      const result = joined ? await leaveChallenge(challengeId, slug) : await joinChallenge(challengeId, slug);
      if (result.error) {
        setError(result.error);
        return;
      }
      setJoined(!joined);
      router.refresh();
    });
  }

  if (!signedIn) {
    return <p className="text-sm text-text-secondary">Sign in to join this challenge.</p>;
  }

  return (
    <div>
      <button type="button" onClick={toggle} disabled={isPending} className={joined ? "btn-secondary" : "btn-primary"}>
        {joined ? "Leave Challenge" : "Join Challenge"}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-xs text-live">
          {error}
        </p>
      )}
    </div>
  );
}
