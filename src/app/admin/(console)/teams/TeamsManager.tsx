"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { AdminTable } from "@/components/admin/AdminTable";
import { AdminForm, AdminSelect, AdminCheckbox } from "@/components/admin/AdminForm";
import { FormField } from "@/components/ui/FormField";
import { createTeam, updateTeam, type TeamInput } from "@/actions/admin/teams";

interface TeamRow {
  id: string;
  name: string;
  short_name: string | null;
  country: string | null;
  active: boolean;
  competition_id: string;
  competitionName: string;
}

interface Competition {
  id: string;
  name: string;
}

const emptyForm = (competitionId = ""): TeamInput => ({
  competitionId,
  name: "",
  shortName: "",
  country: "",
  active: true,
});

export function TeamsManager({
  teams,
  competitions,
}: {
  teams: TeamRow[];
  competitions: Competition[];
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TeamInput>(emptyForm());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setError(null);
    setModalOpen(true);
  }

  function openEdit(row: TeamRow) {
    setEditingId(row.id);
    setForm({
      competitionId: row.competition_id,
      name: row.name,
      shortName: row.short_name ?? "",
      country: row.country ?? "",
      active: row.active,
    });
    setError(null);
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.competitionId) {
      setError("Choose a competition.");
      return;
    }
    setLoading(true);
    setError(null);

    const result = editingId ? await updateTeam(editingId, form) : await createTeam(form);

    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setModalOpen(false);
  }

  if (competitions.length === 0) {
    return (
      <p className="card px-6 py-10 text-center text-sm text-text-secondary">
        Add a competition first — teams belong to a competition.
      </p>
    );
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <button type="button" onClick={openCreate} className="btn-primary gap-1.5">
          <Plus className="h-4 w-4" />
          Add team
        </button>
      </div>

      <AdminTable
        rows={teams}
        keyField={(t) => t.id}
        onRowClick={openEdit}
        emptyTitle="No teams yet."
        emptyDescription="Add the first team under one of your competitions."
        columns={[
          { key: "name", label: "Name", render: (t) => t.name },
          { key: "short_name", label: "Short", render: (t) => t.short_name ?? "—" },
          { key: "competition", label: "Competition", render: (t) => t.competitionName },
          { key: "country", label: "Country", render: (t) => t.country ?? "—" },
          {
            key: "active",
            label: "Status",
            render: (t) => (
              <span className={t.active ? "pill pill-selected" : "pill"}>{t.active ? "Active" : "Inactive"}</span>
            ),
          },
        ]}
      />

      <AdminForm
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? "Edit team" : "Add team"}
        onSubmit={handleSubmit}
        loading={loading}
        error={error}
        submitLabel={editingId ? "Save changes" : "Create team"}
      >
        <AdminSelect
          label="Competition"
          value={form.competitionId}
          onChange={(v) => setForm((f) => ({ ...f, competitionId: v }))}
          options={competitions.map((c) => ({ value: c.id, label: c.name }))}
          required
        />
        <FormField
          label="Name"
          type="text"
          value={form.name}
          onChange={(v) => setForm((f) => ({ ...f, name: v }))}
          required
        />
        <FormField
          label="Short name (optional)"
          type="text"
          value={form.shortName ?? ""}
          onChange={(v) => setForm((f) => ({ ...f, shortName: v }))}
        />
        <FormField
          label="Country (optional)"
          type="text"
          value={form.country ?? ""}
          onChange={(v) => setForm((f) => ({ ...f, country: v }))}
        />
        <AdminCheckbox
          label="Active (visible on the public site)"
          checked={form.active}
          onChange={(v) => setForm((f) => ({ ...f, active: v }))}
        />
      </AdminForm>
    </>
  );
}
