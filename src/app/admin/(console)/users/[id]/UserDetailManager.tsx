"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AdminSelect } from "@/components/admin/AdminForm";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { updateUserRole, setUserSuspended } from "@/actions/admin/users";
import type { Role } from "@/types/database";

interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  email: string;
  phone: string | null;
  role: Role;
  suspended: boolean;
  created_at: string;
}

const ROLE_OPTIONS = [
  { value: "USER", label: "User" },
  { value: "ADMIN", label: "Admin" },
  { value: "SUPER_ADMIN", label: "Super admin" },
];

export function UserDetailManager({
  profile,
  totalPredictions,
  wonPredictions,
  isSuperAdmin,
  isSelf,
}: {
  profile: Profile;
  totalPredictions: number;
  wonPredictions: number;
  isSuperAdmin: boolean;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [role, setRole] = useState<Role>(profile.role);
  const [roleLoading, setRoleLoading] = useState(false);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [suspendLoading, setSuspendLoading] = useState(false);
  const [suspendError, setSuspendError] = useState<string | null>(null);

  async function handleRoleChange(next: string) {
    const nextRole = next as Role;
    setRole(nextRole);
    setRoleError(null);
    setRoleLoading(true);

    const result = await updateUserRole(profile.id, nextRole);

    setRoleLoading(false);
    if (result.error) {
      setRoleError(result.error);
      setRole(profile.role); // revert the select on failure
      return;
    }
    router.refresh();
  }

  async function handleSuspendConfirm() {
    setSuspendLoading(true);
    setSuspendError(null);

    const result = await setUserSuspended(profile.id, !profile.suspended);

    setSuspendLoading(false);
    if (result.error) {
      setSuspendError(result.error);
      return;
    }
    setConfirmOpen(false);
    router.refresh();
  }

  return (
    <div className="max-w-2xl">
      <Link href="/admin/users" className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary">
        <ArrowLeft className="h-4 w-4" />
        Back to users
      </Link>

      <div className="card p-6">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="font-display text-xl font-bold">{profile.display_name ?? profile.username}</h1>
            <p className="text-sm text-text-secondary">@{profile.username}</p>
          </div>
          {profile.suspended && (
            <span className="inline-flex items-center rounded-pill bg-live/15 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-live">
              Suspended
            </span>
          )}
        </div>

        <dl className="mb-6 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-text-secondary">Email</dt>
            <dd className="text-text-primary">{profile.email}</dd>
          </div>
          <div>
            <dt className="text-text-secondary">Phone</dt>
            <dd className="text-text-primary">{profile.phone ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-text-secondary">Joined</dt>
            <dd className="text-text-primary">{new Date(profile.created_at).toLocaleDateString()}</dd>
          </div>
          <div>
            <dt className="text-text-secondary">Predictions</dt>
            <dd className="text-text-primary">{totalPredictions}</dd>
          </div>
          <div>
            <dt className="text-text-secondary">Won</dt>
            <dd className="text-text-primary">{wonPredictions}</dd>
          </div>
        </dl>

        <div className="mb-6 border-t border-border pt-6">
          <h2 className="mb-3 font-display text-sm font-bold uppercase tracking-wide text-text-secondary">Role</h2>
          {isSuperAdmin && !isSelf ? (
            <div className="max-w-xs">
              <AdminSelect label="" value={role} onChange={handleRoleChange} options={ROLE_OPTIONS} />
              {roleLoading && <p className="mt-1 text-xs text-text-secondary">Saving...</p>}
              {roleError && (
                <p role="alert" className="mt-1 text-sm text-live">
                  {roleError}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-text-primary">
              {profile.role}
              {isSelf && <span className="text-text-secondary"> (you can&apos;t change your own role)</span>}
              {!isSuperAdmin && !isSelf && (
                <span className="text-text-secondary"> · only a Super admin can change roles</span>
              )}
            </p>
          )}
        </div>

        <div className="border-t border-border pt-6">
          <h2 className="mb-3 font-display text-sm font-bold uppercase tracking-wide text-text-secondary">
            Account status
          </h2>
          {isSelf ? (
            <p className="text-sm text-text-secondary">You can&apos;t suspend your own account.</p>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setConfirmOpen(true)}
                className={
                  profile.suspended
                    ? "btn-primary"
                    : "inline-flex items-center justify-center rounded-md bg-live px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-live/90"
                }
              >
                {profile.suspended ? "Restore account" : "Suspend account"}
              </button>
              {suspendError && (
                <p role="alert" className="mt-2 text-sm text-live">
                  {suspendError}
                </p>
              )}
            </>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title={profile.suspended ? "Restore this account?" : "Suspend this account?"}
        description={
          profile.suspended
            ? "They'll be able to sign in and use the platform again immediately."
            : "They'll be signed out and blocked from signing back in until you restore the account."
        }
        confirmLabel={profile.suspended ? "Restore" : "Suspend"}
        danger={!profile.suspended}
        loading={suspendLoading}
        onConfirm={handleSuspendConfirm}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
