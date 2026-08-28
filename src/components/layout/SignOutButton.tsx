"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/**
 * Public-site sign-out. Deliberately separate from
 * components/admin/SignOutButton, which redirects to /admin/login —
 * this one belongs on /profile/settings and sends the user home.
 */
export function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      className="flex shrink-0 items-center gap-1.5 text-sm text-text-secondary transition-colors hover:text-text-primary"
      aria-label="Sign out"
    >
      <LogOut className="h-4 w-4" />
      <span className="hidden sm:inline">Sign out</span>
    </button>
  );
}
