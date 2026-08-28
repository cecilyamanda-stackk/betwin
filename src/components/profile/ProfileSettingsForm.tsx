"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FormField } from "@/components/ui/FormField";
import { updateProfile } from "@/actions/profile";
import { SignOutButton } from "@/components/layout/SignOutButton";

interface ProfileSettingsFormProps {
  initialUsername: string;
  initialDisplayName: string;
  initialCountry: string;
}

export function ProfileSettingsForm({ initialUsername, initialDisplayName, initialCountry }: ProfileSettingsFormProps) {
  const router = useRouter();
  const [username, setUsername] = useState(initialUsername);
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [country, setCountry] = useState(initialCountry);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    const result = await updateProfile({ username, displayName, country });

    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setSuccess(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="card flex max-w-md flex-col gap-4 p-6">
      <FormField label="Username" type="text" value={username} onChange={setUsername} required minLength={3} />
      <FormField label="Display name" type="text" value={displayName} onChange={setDisplayName} />
      <FormField label="Country" type="text" value={country} onChange={setCountry} />

      {error && (
        <p role="alert" className="text-sm text-live">
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="text-sm text-success">
          Profile updated.
        </p>
      )}

      <div className="mt-2 flex items-center justify-between">
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "Saving..." : "Save Changes"}
        </button>
        <SignOutButton />
      </div>
    </form>
  );
}
