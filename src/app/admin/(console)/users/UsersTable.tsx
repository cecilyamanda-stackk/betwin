"use client";

import { useRouter } from "next/navigation";
import { AdminTable, type AdminTableColumn } from "@/components/admin/AdminTable";
import type { Role } from "@/types/database";

interface UserRow {
  id: string;
  username: string;
  display_name: string | null;
  email: string;
  role: Role;
  suspended: boolean;
  created_at: string;
}

export function UsersTable({ users }: { users: UserRow[] }) {
  const router = useRouter();

  const columns: AdminTableColumn<UserRow>[] = [
    {
      key: "user",
      label: "User",
      render: (u) => (
        <div>
          <p className="font-semibold">{u.display_name ?? u.username}</p>
          <p className="text-xs text-text-secondary">@{u.username}</p>
        </div>
      ),
    },
    { key: "email", label: "Email", render: (u) => u.email },
    {
      key: "role",
      label: "Role",
      render: (u) => (
        <span className="inline-flex items-center rounded-pill bg-surface-secondary px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-text-primary">
          {u.role}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (u) =>
        u.suspended ? (
          <span className="inline-flex items-center rounded-pill bg-live/15 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-live">
            Suspended
          </span>
        ) : (
          <span className="inline-flex items-center rounded-pill bg-success/15 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-success">
            Active
          </span>
        ),
    },
    {
      key: "joined",
      label: "Joined",
      render: (u) => new Date(u.created_at).toLocaleDateString(),
    },
  ];

  return (
    <AdminTable
      columns={columns}
      rows={users}
      keyField={(u) => u.id}
      onRowClick={(u) => router.push(`/admin/users/${u.id}`)}
      emptyTitle="No users match."
      emptyDescription="Try clearing the search or role filter."
    />
  );
}
