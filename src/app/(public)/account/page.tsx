import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileSettingsForm } from "@/components/profile/ProfileSettingsForm";

/**
 * /account — "Profile Info" (the sidebar's default tab). Same fields and
 * the same updateProfile action as the pre-existing /profile/settings —
 * this doesn't fork the edit logic, just gives it a second, more
 * discoverable home now that /account exists. /profile/settings itself
 * is left in place rather than deleted, in case anything still links
 * there directly.
 */
export default async function AccountProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name, country")
    .eq("id", user.id)
    .single();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-bold">Profile Info</h1>
      <ProfileSettingsForm
        initialUsername={profile?.username ?? ""}
        initialDisplayName={profile?.display_name ?? ""}
        initialCountry={profile?.country ?? ""}
      />
    </div>
  );
}
