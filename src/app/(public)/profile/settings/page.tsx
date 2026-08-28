import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileSettingsForm } from "@/components/profile/ProfileSettingsForm";

/** /profile/settings — edit username/display name/country, or sign out. */
export default async function ProfileSettingsPage() {
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
      <h1 className="font-display text-2xl font-bold">Settings</h1>
      <ProfileSettingsForm
        initialUsername={profile?.username ?? ""}
        initialDisplayName={profile?.display_name ?? ""}
        initialCountry={profile?.country ?? ""}
      />
    </div>
  );
}
