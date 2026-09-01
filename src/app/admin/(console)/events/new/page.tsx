import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { CreateGameWizard } from "./CreateGameWizard";

/**
 * "Create Game" — one flow from picking teams to a published, bettable
 * event, instead of Events -> event detail page -> Markets -> back to
 * Events/Results to publish. Still built entirely out of the same
 * Server Actions those pages use (createEvent, createMarket,
 * createSelection, updateEventStatus) — this only changes the sequence
 * they're called in, not what they do. The granular pages remain the
 * right tool for editing an existing game afterward (re-pricing one
 * selection, adding a market later, etc.) — this is for getting a new
 * one from zero to bettable in one sitting.
 */
export default async function CreateGamePage() {
  await requireAdmin();
  const supabase = await createClient();

  const [{ data: competitions }, { data: teams }] = await Promise.all([
    supabase.from("competitions").select("id, name").order("name"),
    supabase.from("teams").select("id, name, competition_id").order("name"),
  ]);

  return (
    <div>
      <Link href="/admin/events" className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary">
        <ArrowLeft className="h-4 w-4" />
        Events
      </Link>
      <h1 className="mb-6 font-display text-2xl font-bold">Create Game</h1>
      <CreateGameWizard competitions={competitions ?? []} teams={teams ?? []} />
    </div>
  );
}
