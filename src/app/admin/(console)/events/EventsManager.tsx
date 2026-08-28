"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { AdminTable } from "@/components/admin/AdminTable";
import { AdminForm, AdminSelect } from "@/components/admin/AdminForm";
import { EventStatusBadge } from "@/components/admin/EventStatusBadge";
import { createEvent, type EventInput } from "@/actions/admin/events";
import type { EventStatus } from "@/types/database";

interface EventRow {
  id: string;
  start_time: string;
  status: EventStatus;
  home_team_id: string;
  away_team_id: string;
  competition_id: string;
  home_score: number | null;
  away_score: number | null;
  homeTeamName: string;
  awayTeamName: string;
  competitionName: string;
}

interface Competition {
  id: string;
  name: string;
}

interface Team {
  id: string;
  name: string;
  competition_id: string;
}

const emptyForm: EventInput = { competitionId: "", homeTeamId: "", awayTeamId: "", startTime: "" };

export function EventsManager({
  events,
  competitions,
  teams,
}: {
  events: EventRow[];
  competitions: Competition[];
  teams: Team[];
}) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<EventInput>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const teamsInCompetition = useMemo(
    () => teams.filter((t) => t.competition_id === form.competitionId),
    [teams, form.competitionId]
  );

  function openCreate() {
    setForm(emptyForm);
    setError(null);
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.competitionId || !form.homeTeamId || !form.awayTeamId || !form.startTime) {
      setError("Fill in every field.");
      return;
    }
    if (form.homeTeamId === form.awayTeamId) {
      setError("Home and away team must be different.");
      return;
    }
    setLoading(true);
    setError(null);

    const result = await createEvent({
      ...form,
      startTime: new Date(form.startTime).toISOString(),
    });

    setLoading(false);
    if (result.error || !result.data) {
      setError(result.error ?? "Something went wrong.");
      return;
    }
    setModalOpen(false);
    router.push(`/admin/events/${result.data.id}`);
  }

  if (competitions.length === 0) {
    return (
      <p className="card px-6 py-10 text-center text-sm text-text-secondary">
        Add a competition with at least two teams first.
      </p>
    );
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <button type="button" onClick={openCreate} className="btn-primary gap-1.5">
          <Plus className="h-4 w-4" />
          Add event
        </button>
      </div>

      <AdminTable
        rows={events}
        keyField={(e) => e.id}
        onRowClick={(e) => router.push(`/admin/events/${e.id}`)}
        emptyTitle="No events yet."
        emptyDescription="Create the first event to start building markets on it."
        columns={[
          {
            key: "matchup",
            label: "Matchup",
            render: (e) => (
              <span>
                {e.homeTeamName} <span className="text-text-secondary">vs</span> {e.awayTeamName}
                {e.status === "FINISHED" && (
                  <span className="ml-2 text-text-secondary">
                    ({e.home_score}–{e.away_score})
                  </span>
                )}
              </span>
            ),
          },
          { key: "competition", label: "Competition", render: (e) => e.competitionName },
          {
            key: "start_time",
            label: "Start",
            render: (e) => new Date(e.start_time).toLocaleString(),
          },
          { key: "status", label: "Status", render: (e) => <EventStatusBadge status={e.status} /> },
        ]}
      />

      <AdminForm
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add event"
        onSubmit={handleSubmit}
        loading={loading}
        error={error}
        submitLabel="Create draft event"
      >
        <AdminSelect
          label="Competition"
          value={form.competitionId}
          onChange={(v) => setForm({ competitionId: v, homeTeamId: "", awayTeamId: "", startTime: form.startTime })}
          options={competitions.map((c) => ({ value: c.id, label: c.name }))}
          required
        />
        <AdminSelect
          label="Home team"
          value={form.homeTeamId}
          onChange={(v) => setForm((f) => ({ ...f, homeTeamId: v }))}
          options={teamsInCompetition.map((t) => ({ value: t.id, label: t.name }))}
          placeholder={form.competitionId ? "Select..." : "Choose a competition first"}
          required
        />
        <AdminSelect
          label="Away team"
          value={form.awayTeamId}
          onChange={(v) => setForm((f) => ({ ...f, awayTeamId: v }))}
          options={teamsInCompetition.map((t) => ({ value: t.id, label: t.name }))}
          placeholder={form.competitionId ? "Select..." : "Choose a competition first"}
          required
        />
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-text-secondary">Start time</span>
          <input
            type="datetime-local"
            value={form.startTime}
            onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
            required
            className="rounded-md border border-border bg-surface-secondary px-3 py-2 text-text-primary focus:border-gold/60"
          />
        </label>
        <p className="text-xs text-text-secondary">
          Events are created as DRAFT. Add markets and publish from the event page next.
        </p>
      </AdminForm>
    </>
  );
}
