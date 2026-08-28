"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { AdminTable } from "@/components/admin/AdminTable";
import { AdminForm, AdminSelect, AdminCheckbox } from "@/components/admin/AdminForm";
import { FormField } from "@/components/ui/FormField";
import { slugify } from "@/lib/utils/slug";
import {
  createCompetition,
  updateCompetition,
  type CompetitionInput,
} from "@/actions/admin/competitions";

interface CompetitionRow {
  id: string;
  name: string;
  slug: string;
  country: string | null;
  active: boolean;
  sport_id: string;
  sportName: string;
}

interface Sport {
  id: string;
  name: string;
}

const emptyForm = (sportId = ""): CompetitionInput => ({
  sportId,
  name: "",
  slug: "",
  country: "",
  active: true,
});

export function CompetitionsManager({
  competitions,
  sports,
}: {
  competitions: CompetitionRow[];
  sports: Sport[];
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CompetitionInput>(emptyForm());
  const [slugTouched, setSlugTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setSlugTouched(false);
    setError(null);
    setModalOpen(true);
  }

  function openEdit(row: CompetitionRow) {
    setEditingId(row.id);
    setForm({
      sportId: row.sport_id,
      name: row.name,
      slug: row.slug,
      country: row.country ?? "",
      active: row.active,
    });
    setSlugTouched(true);
    setError(null);
    setModalOpen(true);
  }

  function updateName(name: string) {
    setForm((f) => ({ ...f, name, slug: slugTouched ? f.slug : slugify(name) }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.sportId) {
      setError("Choose a sport.");
      return;
    }
    setLoading(true);
    setError(null);

    const result = editingId
      ? await updateCompetition(editingId, form)
      : await createCompetition(form);

    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setModalOpen(false);
  }

  if (sports.length === 0) {
    return (
      <p className="card px-6 py-10 text-center text-sm text-text-secondary">
        Add a sport first — competitions belong to a sport.
      </p>
    );
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <button type="button" onClick={openCreate} className="btn-primary gap-1.5">
          <Plus className="h-4 w-4" />
          Add competition
        </button>
      </div>

      <AdminTable
        rows={competitions}
        keyField={(c) => c.id}
        onRowClick={openEdit}
        emptyTitle="No competitions yet."
        emptyDescription="Add the first competition under one of your sports."
        columns={[
          { key: "name", label: "Name", render: (c) => c.name },
          { key: "sport", label: "Sport", render: (c) => c.sportName },
          { key: "country", label: "Country", render: (c) => c.country ?? "—" },
          {
            key: "active",
            label: "Status",
            render: (c) => (
              <span className={c.active ? "pill pill-selected" : "pill"}>{c.active ? "Active" : "Inactive"}</span>
            ),
          },
        ]}
      />

      <AdminForm
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? "Edit competition" : "Add competition"}
        onSubmit={handleSubmit}
        loading={loading}
        error={error}
        submitLabel={editingId ? "Save changes" : "Create competition"}
      >
        <AdminSelect
          label="Sport"
          value={form.sportId}
          onChange={(v) => setForm((f) => ({ ...f, sportId: v }))}
          options={sports.map((s) => ({ value: s.id, label: s.name }))}
          required
        />
        <FormField label="Name" type="text" value={form.name} onChange={updateName} required />
        <FormField
          label="Slug"
          type="text"
          value={form.slug}
          onChange={(v) => {
            setSlugTouched(true);
            setForm((f) => ({ ...f, slug: v }));
          }}
          required
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
