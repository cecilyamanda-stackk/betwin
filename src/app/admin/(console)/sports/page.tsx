import { requireAdmin } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { SportsManager } from "./SportsManager";

export default async function AdminSportsPage() {
  await requireAdmin();
  const supabase = await createClient();

  const { data: sports } = await supabase
    .from("sports")
    .select("id, name, slug, icon, active")
    .order("name");

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Sports</h1>
      </div>
      <SportsManager sports={sports ?? []} />
    </div>
  );
}
