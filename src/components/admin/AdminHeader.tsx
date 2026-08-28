import Link from "next/link";
import { BrandLogo } from "@/components/layout/BrandLogo";
import { SignOutButton } from "@/components/admin/SignOutButton";

interface AdminHeaderProps {
  displayName: string;
  role: string;
}

/** Top bar for every /admin page — identity + sign out, always visible. */
export function AdminHeader({ displayName, role }: AdminHeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-surface px-4 md:px-6">
      <Link href="/admin/dashboard" className="flex items-center gap-2">
        <BrandLogo showWordmark={false} />
        <span className="font-display text-sm font-bold text-text-primary">Admin</span>
      </Link>
      <div className="flex items-center gap-4">
        <span className="text-sm text-text-secondary">
          <span className="text-text-primary">{displayName}</span> · {role}
        </span>
        <SignOutButton />
      </div>
    </header>
  );
}
